# voice-dictation Specification

## Purpose

Let users dictate a Brain dump message through their microphone and review the resulting text in the chat composer before extracting tasks.

## Requirements

### Requirement: Explicit microphone recording

The Brain dump composer on `/todos` SHALL offer accessible Record, Stop, and Cancel controls. Recording SHALL start only after the user selects Record and grants microphone permission. The interface SHALL show permission-waiting, recording, and transcription progress. Stop SHALL initiate transcription; Cancel SHALL discard the current dictation session.

#### Scenario: Record and transcribe

- **WHEN** the user selects Record, grants permission, speaks, and selects Stop
- **THEN** the interface records that session and requests one transcription
- **AND** progress identifies whether recording or transcription is active

#### Scenario: Permission denied or unavailable microphone

- **WHEN** microphone permission is denied or microphone access is unavailable
- **THEN** the interface shows a useful error and returns to an idle state
- **AND** the existing draft remains available for typing

### Requirement: Browser recording compatibility

The system SHALL select an audio recording format supported by the browser and the transcription service. Unsupported recording environments SHALL display a clear explanation and preserve typed input. The composer SHALL explain that recordings are sent through OpenRouter for transcription.

#### Scenario: Alternate supported browser format

- **WHEN** the browser supports an accepted recording format other than WebM
- **THEN** dictation uses that format and correctly identifies it when uploading

#### Scenario: No usable recording support

- **WHEN** the browser has no usable microphone or accepted recording format
- **THEN** dictation is unavailable with a visible explanation
- **AND** typed task extraction and manual task entry remain available

### Requirement: Transcription appends to the current draft

A successful nonblank transcript SHALL append to the current Brain dump draft with separating whitespace as needed. Existing draft content and edits made during dictation SHALL be preserved. Dictation SHALL NOT submit a chat message, invoke task extraction, or mutate todos. The user SHALL review or edit the combined text before explicitly submitting it.

#### Scenario: Dictate into an empty composer

- **WHEN** transcription returns a nonblank transcript and the draft is empty
- **THEN** the transcript appears in the editable composer
- **AND** no conversation message or todo is created

#### Scenario: Preserve edits while waiting

- **GIVEN** the user changes the draft during recording or transcription
- **WHEN** the transcript arrives
- **THEN** it appends to the latest draft exactly once without replacing those edits

#### Scenario: Submit reviewed text

- **WHEN** the user selects Extract tasks after reviewing the transcript
- **THEN** the combined draft follows the existing text extraction flow

### Requirement: Preserve draft length and empty-result behavior

The combined draft SHALL remain subject to the existing 10,000-character message limit. If appending a transcript would exceed this limit, the system SHALL preserve the draft and show a length error without truncating or partially inserting text. A blank transcript SHALL leave the draft unchanged and show that no speech was transcribed.

#### Scenario: Transcript would exceed the draft limit

- **WHEN** the current draft plus separating whitespace and transcript exceed 10,000 characters
- **THEN** the draft remains unchanged and a length error is visible

#### Scenario: Empty transcription

- **WHEN** the service returns an empty or whitespace-only transcript
- **THEN** the draft remains unchanged and the interface reports no transcribed speech

### Requirement: One active dictation session

The composer SHALL permit at most one permission request, recording, or transcription session at a time. Task extraction SHALL be blocked through every submission and Retry path while dictation is active. Dictation SHALL be blocked while extraction is pending. Manual task entry SHALL remain available.

#### Scenario: Repeated controls and submissions

- **WHEN** the user repeatedly activates Record or Stop, submits with Enter, or selects an extraction Retry during an active dictation session
- **THEN** at most one recording and transcription request occur
- **AND** no extraction request is dispatched until dictation settles

#### Scenario: Extraction already pending

- **WHEN** task extraction is pending
- **THEN** a new dictation session cannot begin
- **AND** manual task entry remains usable

### Requirement: Bounded recording and safe cancellation

Recording SHALL stop and begin transcription after at most 120 seconds, with visible feedback. Cancel or leaving the page SHALL stop microphone tracks, discard buffered audio, and cancel pending transcription. Results from cancelled or superseded sessions SHALL NOT change the draft. Audio SHALL NOT be persisted by the application.

#### Scenario: Recording reaches its time limit

- **WHEN** a recording reaches 120 seconds
- **THEN** recording ends, microphone tracks are released, and one transcription begins
- **AND** the interface explains that the recording limit was reached

#### Scenario: Cancel before or during transcription

- **WHEN** the user selects Cancel during permission acquisition, recording, or transcription
- **THEN** the current session ends without inserting text
- **AND** any subsequently acquired microphone stream is immediately stopped and any late transcript is ignored

#### Scenario: Leave the page

- **WHEN** the user leaves `/todos` with dictation active
- **THEN** the application releases microphone resources and cancels pending work without uploading a discarded recording or applying late output

### Requirement: Server-controlled OpenRouter transcription

`POST /api/audio/transcribe` SHALL send validated audio to OpenRouter using the server-only `OPENROUTER_API_KEY`. The server SHALL use the trimmed `OPENROUTER_TRANSCRIPTION_MODEL` setting or `openai/whisper-large-v3-turbo` when unset or blank. Browser fields SHALL NOT choose a model or credentials. Language SHALL be auto-detected. No alternate-model fallback SHALL occur.

#### Scenario: Default transcription model

- **WHEN** a valid recording is submitted with a configured OpenRouter key and no nonblank transcription model setting
- **THEN** OpenRouter receives `openai/whisper-large-v3-turbo`
- **AND** the browser receives no provider key

#### Scenario: Separate operator configuration

- **GIVEN** the operator sets a supported open-weight transcription model with surrounding whitespace
- **WHEN** a browser upload also supplies a different model field
- **THEN** the server uses its trimmed transcription model setting
- **AND** the task extraction model setting is unaffected

### Requirement: Validate the audio request and transcript response

The endpoint SHALL accept multipart form data with one nonempty `audio` file of at most 10 MiB in WebM, Ogg, MP4/M4A, or WAV format. It SHALL bound the entire incoming body to 11 MiB without trusting Content-Length. Invalid requests SHALL fail before provider access. A successful response SHALL be `{ text: string }`, trimmed and at most 10,000 characters; invalid provider output SHALL NOT be returned as a transcript.

#### Scenario: Valid upload and transcript

- **WHEN** a valid supported recording produces a string transcript within the limit
- **THEN** the endpoint returns HTTP 200 with the trimmed text
- **AND** provider usage and other metadata are omitted

#### Scenario: Invalid or oversized upload

- **WHEN** an upload is malformed, lacks exactly one nonempty audio file, or declares an unsupported audio format
- **THEN** the endpoint returns HTTP 400 without contacting OpenRouter
- **WHEN** the file exceeds 10 MiB or the body exceeds 11 MiB
- **THEN** the endpoint returns HTTP 413 without contacting OpenRouter, even if Content-Length is missing or inaccurate

#### Scenario: Invalid provider output

- **WHEN** OpenRouter returns malformed JSON, a non-string transcript, or text exceeding 10,000 characters
- **THEN** the endpoint returns a safe HTTP 502 error and no transcript is inserted

### Requirement: Recoverable transcription failures

A valid request without an OpenRouter key SHALL return HTTP 503. Provider errors, invalid output, and a transcription call exceeding 60 seconds SHALL return safe HTTP 502 errors. Request cancellation SHALL abort upstream work. The interface SHALL preserve the draft on failure, display a useful error, and allow another recording or continued typing. Provider exceptions and credentials SHALL NOT be exposed.

#### Scenario: Missing credentials

- **WHEN** a valid recording is uploaded without a nonblank OpenRouter key
- **THEN** the endpoint returns HTTP 503 and the draft is preserved

#### Scenario: Provider failure or timeout

- **WHEN** transcription fails or exceeds 60 seconds
- **THEN** the upstream request ends and the interface shows a safe error
- **AND** no text, chat message, or todo is added
- **AND** the user can record again or type

#### Scenario: Browser cancels its request

- **WHEN** a transcription request is cancelled
- **THEN** the server aborts upstream work and the composer ignores any late result
