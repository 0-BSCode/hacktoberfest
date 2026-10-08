# Design

## Context

See `proposal.md` for motivation and `specs/voice-dictation/spec.md` for the behavior contract. `/todos` owns its draft in `src/routes/todos.tsx` and submits text through one `extract()` function, used by the form, Enter, and Retry. `/api/tasks/extract` already uses server-only OpenRouter configuration and validates complete results.

The separate demo chat already appends a microphone transcript to its draft. Its `useAudioRecorder` hook hardcodes WebM/Opus and posts to `/demo/api/transcription`, while the declared route is `/demo/api/ai/transcription`. It lacks unmount cleanup, abort handling, and visible transcription errors. The demo endpoint uses OpenAI's hosted API; changing that provider is outside this proposal.

The installed OpenRouter adapter exports no transcription adapter. Native `fetch` is already available. OpenRouter documents a dedicated transcription endpoint and Whisper models, so this does not require audio input to the Qwen chat model.

## Goals / Non-Goals

**Goals:** Keep microphone ownership and upload lifecycle in the existing hook; keep draft insertion in the composer and provider credentials in the server. Bound work and ensure cancellation cannot insert stale text.

**Non-Goals:** No generic provider abstraction, audio storage, local model runtime, new SDK, live transcript streaming, automatic submission, language selector, or change to task extraction and persistence. Demo changes are limited to integrating the shared recorder behavior and fixing its endpoint default.

## Decisions

### Use a separate transcription endpoint and native fetch

Add `src/routes/api.audio.transcribe.ts` for `POST /api/audio/transcribe`. The browser submits a multipart `audio` file. The server validates it, constructs a new upstream multipart body containing `file`, its configured `model`, and `response_format=json`, and posts to `https://openrouter.ai/api/v1/audio/transcriptions` with Bearer authorization. It returns only `{ text }`.

OpenRouter accepts OpenAI-compatible multipart requests, which avoids base64 expansion and custom audio encoding. Calling chat completions with an instruction to transcribe introduces unnecessary prompting and conversational output. The OpenAI adapter can target compatible endpoints, but its model-specific typing and response normalization add work for an endpoint that only needs one string. Native fetch requires no new dependency or adapter.

Reuse trimmed `OPENROUTER_API_KEY`. Add independent `OPENROUTER_TRANSCRIPTION_MODEL`, defaulting to `openai/whisper-large-v3-turbo` when unset or blank. Operators must choose an available open-weight transcription model accepting the selected formats. Ignore extra browser configuration fields. Omit language to use automatic detection and request transcription rather than translation. Keep `OPENROUTER_MODEL` exclusively for existing text extraction, and do not silently fall back to another speech model.

### Validate bounded input and output at the server

Read at most 11 MiB from the incoming request stream before parsing multipart data, including when Content-Length is absent or misleading. Then require exactly one `audio` File, a nonzero size no greater than 10 MiB, and an allowed declared MIME type mapped to WebM, Ogg, MP4/M4A, or WAV. Reject malformed input with 400 and size overflow with 413 before making any provider call. File extensions alone do not establish format; unsupported or corrupt audio rejected by the provider becomes a safe upstream failure.

Require an upstream success response with a string `text`, trim it, and reject a transcript over 10,000 characters. Empty trimmed text is a successful empty result for the composer to explain. Use 503 for missing credentials and 502 for provider, output, or timeout errors; expose fixed user-facing messages rather than provider exceptions. Do not return usage metadata, log recordings, or save audio.

Propagate request cancellation to upstream fetch and impose a 60-second upstream timeout. Always remove listeners and clear timers. Cancellation stops further local processing; it cannot guarantee that a provider has not already processed or billed an accepted recording.

The byte and duration limits are proposed initial defaults, not user-specified requirements. A 10 MiB audio cap stays below OpenRouter's documented 25 MB multipart cap. Bound bytes rather than adding an audio decoder solely to inspect duration on the server.

### Reuse the recorder hook with one result delivery path

Keep `src/hooks/demo-useAudioRecorder.ts` and allow a transcription endpoint plus an `onTranscript` callback. `/todos` selects `/api/audio/transcribe`; the demo uses the corrected `/demo/api/ai/transcription` default. Both callers consume the callback so manual Stop and the time limit deliver text through the same path exactly once. Remove the redundant browser model field; the existing demo endpoint already defaults to `whisper-1`.

Use the native microphone and MediaRecorder APIs. Select a supported format with `MediaRecorder.isTypeSupported`, preferring WebM/Opus, then Ogg/Opus, then MP4/AAC. Send the actual recorder MIME type and corresponding filename. If no accepted format is available, explain that typing still works. Do not add a transcoding library.

Represent the small lifecycle directly as idle, starting, recording, and transcribing, with visible error or empty-result feedback. Hold the synchronous session guard in a ref so repeated clicks do not race React updates. A session token prevents an old permission result, recorder stop event, or upload response from affecting a cancelled or newer session.

At 120 seconds, invoke the same Stop path and explain the automatic stop. Cancel invalidates the session before stopping tracks or aborting upload, so the stop event cannot upload discarded audio. Cleanup on unmount does the same. If permission resolves after cancellation, stop that newly acquired stream immediately. Release tracks on normal Stop, errors, and constructor/start failures; clear chunks and timers when settled. Reject oversized recordings with visible feedback rather than uploading them.

### Insert into the latest draft and coordinate submission

The `/todos` callback uses a functional draft update so edits during recording or transcription are preserved. Append trimmed transcript with a space only when existing text needs a separator. Reject the entire insertion if the combined text would exceed 10,000 characters. Never truncate, replace the draft, or create a chat message from a transcript alone.

Keep the text area editable during dictation. Gate the shared `extract()` function as well as its form and Retry controls while the recorder is starting, recording, or transcribing. This covers Enter and prevents a response from arriving after a submission cleared the draft. Disable Record while extraction is pending; preserve manual task entry. Display errors next to the composer, announce progress through a polite status region, and provide explicit accessible control names and recording state. Include a brief disclosure that audio is sent to OpenRouter.

## Risks / Trade-offs

- Browser format support varies. Select a supported accepted format and smoke-test WebM and MP4 paths; unsupported browsers retain typing.
- Recognition can mishear names, noise, or mixed-language speech. Always insert editable text and check representative recordings before claiming accuracy.
- Long pauses can still produce incorrect text. Empty-result checks do not establish semantic accuracy; user review remains necessary.
- Hosted transcription adds upload latency and usage charges. Show progress, bound recording/upload work, and allow cancellation without adding automatic retries.
- Sharing the hook affects the demo caller. Verify its endpoint, draft insertion, and cleanup without migrating its provider.

## Migration Plan

1. Implement the endpoint, shared recorder changes, and `/todos` controls. Regenerate routes using the project's existing command.
2. Add one focused assertion-based check file using controlled server/provider responses, following the existing Node check pattern. Cover validation, model configuration, request serialization, output validation, safe failures, and abort propagation without network access. Preserve the existing todo checks.
3. Verify the recording lifecycle and composer in the browser: denied permission, permission cancelled before resolution, Record/Stop/Cancel, timeout, repeated clicks, edits while waiting, Enter/Retry blocking, empty/error output, length overflow, and leaving the page. Check the shared demo caller.
4. Document the same server key, optional speech model setting, limits, and upload disclosure. Run focused checks, type checking, targeted formatting/lint checks, and a production build.
5. When credentials and a representative recording are available, smoke-test the selected model and browser audio format. Record the limitation if live provider behavior cannot be tested; planning research is not a live transcription test.
6. Deploy with the existing OpenRouter key and optional transcription model setting, restart the server, and verify a short dictation. Roll back the code and remove the optional setting if needed; saved todos require no migration.

## References

- [OpenRouter speech-to-text contract and multipart support](https://openrouter.ai/docs/guides/overview/multimodal/stt)
- [Whisper Large V3 Turbo on OpenRouter](https://openrouter.ai/openai/whisper-large-v3-turbo)
- [Whisper weights and license](https://github.com/openai/whisper)
- [Browser microphone permission and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MediaRecorder format capability checks](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
