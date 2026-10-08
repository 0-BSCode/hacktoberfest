# Proposal

## Why

The Brain dump chat on `/todos` requires typing, which makes spoken task dumps inconvenient. Voice dictation should turn a microphone recording into an editable chat draft using an open-weight model hosted through OpenRouter.

## What Changes

- Add Record, Stop, and Cancel controls with visible recording, transcription, and error feedback in the Brain dump composer.
- On Stop, upload audio through the application's server to OpenRouter and append the returned transcript to the current draft. The user reviews the text and explicitly selects Extract tasks; transcription never submits a message or creates todos.
- Add `POST /api/audio/transcribe` with bounded audio input, validated text output, cancellation, and safe errors. Reuse the server-only `OPENROUTER_API_KEY` and default to `openai/whisper-large-v3-turbo`, with a separate optional transcription model setting.
- Reuse and harden the existing recorder hook, including browser recording-format selection, cleanup, and protection against duplicate or stale results. Correct its demo endpoint default while preserving the demo's existing transcription provider.
- Document hosted audio processing and verify draft preservation, microphone cleanup, and the server request contract.

## Capabilities

### New Capabilities

- `voice-dictation`: Record microphone audio, transcribe it through OpenRouter, and safely insert the transcript into the Brain dump draft for user review.

### Modified Capabilities

None. Task extraction and todo persistence keep their existing requirements. Their completed predecessor changes have not yet been archived into main specs; this change adds a separate capability.

## Impact

- `src/routes/todos.tsx` gains dictation controls and coordination with the existing extraction action.
- `src/hooks/demo-useAudioRecorder.ts` becomes a reusable recorder with a configurable endpoint; `src/routes/demo/ai-chat.tsx` remains compatible with the shared hook.
- A new `src/routes/api.audio.transcribe.ts` endpoint uses native server `fetch` to call OpenRouter. Route generation updates `src/routeTree.gen.ts` during implementation.
- Focused assertion-based checks and README instructions cover the new behavior. No new runtime dependency, model download, database, or local transcription service is needed.
- Proposed initial limits are 120 seconds per recording and 10 MiB per audio file. Live partial transcripts, speech playback, uploaded-file transcription, automatic task extraction, and migration of demo providers are outside this change.
