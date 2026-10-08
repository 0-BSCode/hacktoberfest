# Tasks

## 1. OpenRouter transcription endpoint

- [x] 1.1 Add `src/routes/api.audio.transcribe.ts` with an 11 MiB bounded multipart body, exactly one nonempty `audio` file up to 10 MiB, and accepted WebM/Ogg/MP4/M4A/WAV MIME types. Add controlled checks in one assertion-based `src/lib/voice-dictation.test.ts` file; verify malformed, missing, duplicate, unsupported, and oversized input returns 400/413 before any provider call, including missing or misleading Content-Length.
- [x] 1.2 Implement native fetch to OpenRouter's transcription endpoint using the server key, trimmed independent `OPENROUTER_TRANSCRIPTION_MODEL` setting and Whisper Turbo default, upstream multipart `file`/`model`/`response_format=json`, and validated `{ text }` output. Extend the same checks to verify serialization, key isolation, ignored browser model fields, default and overridden configuration, trimmed/blank/invalid/oversized output, 503/502 errors, the 60-second timeout, and upstream cancellation without external network access.
- [x] 1.3 Regenerate routes with `pnpm generate-routes` and document the endpoint, configuration, accepted formats, limits, and safe errors in README.md. Verify the generated route is `/api/audio/transcribe` and run `node --experimental-test-module-mocks src/lib/voice-dictation.test.ts` with Node 24 using the documented command.

## 2. Shared microphone lifecycle

- [x] 2.1 Update `src/hooks/demo-useAudioRecorder.ts` to accept an endpoint and transcript callback, select an accepted browser recording format, and guard starting/recording/transcribing sessions synchronously. Verify supported-format selection, denied permission, constructor/start failures, repeated Record/Stop, and one transcript callback per session with controlled browser checks; record the results and recording requirements in README.md.
- [x] 2.2 Add Cancel, the 120-second automatic Stop path, bounded audio handling, upload abort, and cleanup on every exit. Verify cancellation before permission resolves, cancellation while recording/uploading, size overflow, automatic-stop delivery, microphone release, timer cleanup, and ignored late results by exercising the actual hook in the browser.
- [x] 2.3 Adapt `src/routes/demo/ai-chat.tsx` to the shared callback and visible feedback, and correct the hook's default demo URL to `/demo/api/ai/transcription` without changing its provider. Verify both manual and automatic Stop append once, errors remain visible, and leaving the demo releases the microphone; document that demo credentials remain separate.

## 3. Brain dump composer

- [x] 3.1 Add accessible Record/Stop/Cancel controls, polite progress, visible dictation errors, and hosted-audio disclosure in `src/routes/todos.tsx`. Connect the OpenRouter endpoint and append to the latest draft without automatic submission. Verify empty and existing drafts, edits during upload, separating whitespace, empty transcripts, exact 10,000-character boundaries, and overflow preserving the entire existing draft.
- [x] 3.2 Guard the shared `extract()` function and all form/Enter/Retry paths while dictation is active, and prevent dictation while extraction is pending. Verify duplicate controls dispatch at most one request, typing remains possible during dictation, manual task entry remains usable, and explicitly submitting the reviewed transcript still follows existing task extraction and persistence behavior.
- [x] 3.3 Document the Record/Stop/review/Extract tasks interaction, cancellation, the two-minute limit, HTTPS/localhost microphone requirement, and recovery by re-recording or typing in README.md. Verify keyboard-accessible labels, progress announcements, and the documented flow against the running composer.

## 4. Integration validation

- [x] 4.1 Run the new controlled checks and existing `node --experimental-test-module-mocks src/lib/todo.test.ts`, `pnpm exec tsc --noEmit`, targeted Biome checks for changed implementation files, and `pnpm build`. Verify both transcription routes are registered, saved todos survive reload, and no new runtime dependency or provider credential enters the browser bundle.
- [x] 4.2 Smoke-test a short representative microphone recording through the selected OpenRouter model when credentials and audio are available, including a supported alternate browser format where available. Verify transcript insertion creates no chat message/todo before explicit submission, cancellation cannot insert late text, and leaving the page releases the microphone; record any live-provider or browser compatibility checks that remain unverified.
