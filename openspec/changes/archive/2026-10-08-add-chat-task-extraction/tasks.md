# Tasks

## 1. Extraction contract and endpoint

- [x] 1.1 Add a shared task-title schema plus request, extraction-result, and saved-todo schemas in `src/lib/todo.ts`; leave one runnable assertion check using built-in assertions and the available runtime, and verify valid data, empty batches, wrong types, manual title trimming and length limits, whitespace, input/output limits, and saved completion state.
- [x] 1.2 Add `POST /api/tasks/extract` in `src/routes/api.tasks.extract.ts` using typed TanStack AI structured output, the existing OpenAI adapter, and extraction-only instructions; verify a multi-task message produces the expected JSON shape and a modification-only message returns no tasks using a controlled model response, plus a real-provider smoke check when credentials are available.
- [x] 1.3 Validate before model invocation and return safe errors for malformed input, missing configuration, provider failures, and invalid output; verify HTTP client errors do not invoke the model, failure responses contain no credentials or raw provider exception, and invalid batches return no partial tasks using the same small check or controlled request harness.
- [x] 1.4 Document `/api/tasks/extract`, its limits, `OPENAI_API_KEY`, and the server-only credential boundary in `README.md`; verify examples match the implemented request, response, and error behavior, and record whether a live model request was verified.

## 2. Todo workspace and browser storage

- [x] 2.1 Add `/todos` with an empty state, title list, native labeled completion checkboxes, and a side chat layout using existing styles; verify keyboard toggling changes only the selected todo without an AI request, and the narrow layout has no horizontal overflow.
- [x] 2.2 Add a labeled manual task-title input and Add button with Enter submission, shared title validation, and independent form state; verify a valid title appends one incomplete todo and clears the input, blank or oversized titles add nothing, existing tasks remain intact, and manual entry works without an AI request even when extraction is unavailable or pending. Document manual entry in `README.md`.
- [x] 2.3 Load and validate saved todos after mounting and save explicit list changes under a dedicated storage key; verify manual and extracted titles, identities, order, and completion survive reloads, initialization never erases saved data, and malformed data or blocked storage shows a warning while leaving the page usable.
- [x] 2.4 Add the Todos navigation link and generate route types with `pnpm generate-routes`; verify the link resolves to `/todos` and existing navigation still works. Document browser-only persistence, session-only chat history, and lack of live synchronization in `README.md`.

## 3. Chat submission and automatic addition

- [x] 3.1 Connect the composer to the extraction endpoint with one guarded submission handler, processing feedback, and session-only message history; verify blank input sends nothing, form and keyboard paths work, repeated submit while pending dispatches one request, and results after unmount do not update the page.
- [x] 3.2 Validate the entire response, create local task identities, and append returned titles to the current list in one functional update with a deterministic acknowledgement; verify an existing completed todo and a manual task added during extraction remain intact, a successful batch appears once in returned order, and an empty result or modification-only message changes no todos and explains the limited chat scope.
- [x] 3.3 Preserve failed messages for explicit retry and show accessible failure feedback without appending tasks; verify network failure, service unavailability, and invalid response data leave the list unchanged, and a successful retry adds one batch. Document the extraction/addition workflow and defer chat editing, completion, and deletion explicitly.

## 4. Integration verification

- [x] 4.1 Run the runnable contract check, focused Biome checks for touched files, and `pnpm build`; verify the new routes compile and report unrelated baseline failures separately.
- [x] 4.2 Exercise the full `/todos` workflow on wide and narrow screens: manually add tasks through Add and Enter, submit a mixed task dump, add a manual task while extraction is pending, see automatic addition, toggle a checkbox, reload, submit a message without tasks, and recover from an extraction error while continuing to add tasks manually; verify persisted todos and accessible feedback match both delta specs, and existing AI demos retain their routes and behavior.

## 5. Confirmed direct deletion

- [x] 5.1 Add a native button showing a trash icon on the right of each task row, outside its checkbox label, using the existing icon library and red danger styling with hover and visible focus states. Provide a task-specific deletion label, tooltip, minimum 44-pixel target, and keyboard activation. Use a themed confirmation dialog naming the task before removal, with Cancel initially focused and Escape dismissal; canceling or dismissing must leave task state and saved data unchanged. On confirmation, remove only the selected ID from the latest list in a functional update and reuse existing persistence and storage-failure feedback. Keep deletion available while extraction is pending or unavailable, without an AI request. Document direct deletion and its confirmation in `README.md`, retaining the deferred scope for chat deletion.
- [x] 5.2 Verify confirmation and cancellation on wide and narrow screens, including keyboard activation, incomplete and completed tasks, duplicate titles, preservation of other tasks and ordering, deletion of the last task, persistence after reload, and storage-write failure. With a delayed controlled extraction response, verify confirmed deletion remains effective when the returned batch appends. Run the existing runnable check, focused Biome checks, and build; report unrelated baseline failures separately.
