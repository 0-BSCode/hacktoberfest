# Design

## Context

See `proposal.md` for motivation and the delta specs for behavior. The project is a TanStack Start app with React, Tailwind, Zod, and TanStack AI already installed. Its recipe route, `src/routes/demo/api.ai.structured.ts`, uses `chat({ outputSchema })` with `openaiText('gpt-4o')`. The installed TanStack AI 0.65.1 returns a validated object when `outputSchema` is supplied without `stream: true`; the new endpoint can use this typed API without copying the demo's `as any` cast.

The guitar chat uses streaming and tools, but task extraction needs neither. There is no todo data model or durable chat store. `ThemeToggle.tsx` demonstrates browser storage access, and the app has existing layout, theme tokens, and form styles to reuse. No existing capability specs constrain this addition.

This design is needed because the change crosses the UI, server request boundary, model output validation, and browser persistence.

## Goals / Non-Goals

**Goals:**

- Keep model extraction separate from client-owned todo state, with a small validated JSON contract.
- Let users add tasks directly without depending on model access or chat progress.
- Let users delete an individual task directly after confirming their choice.
- Retain tasks across reloads without introducing a database or new dependency.
- Keep failures recoverable and prevent initialization or retries from losing tasks.

**Non-Goals:**

- No general chat framework, agent loop, tools, or provider-selection abstraction for this feature.
- No new durable chat history or conversation context sent to the model.
- No live synchronization between tabs or devices. Existing demos do not need refactoring.

## Decisions

### Use a dedicated structured extraction endpoint

Add `POST /api/tasks/extract` in `src/routes/api.tasks.extract.ts`. Its request is `{ message: string }`; its successful response is `{ tasks: string[] }`. Put request, result, and saved-todo schemas in `src/lib/todo.ts` so browser and server validation agree without importing server credentials into client code.

Use the existing OpenAI structured-output pattern and `gpt-4o` as an initial implementation default, with `OPENAI_API_KEY` on the server. Check for missing configuration and return a safe service-unavailable error. No key contents are inspected or assumed to be configured during planning. A live extraction smoke check is required during implementation when credentials are available.

Validate requests before invoking the model. Trim input and accept 1 to 10,000 characters; reject malformed JSON, wrong types, blank input, and oversized input with a client error. Validate the complete result against a batch schema allowing zero to 50 titles, each trimmed, nonempty, and at most 500 characters. These limits are proposed conservative defaults, not inferred user requirements. Reject the whole result if validation fails.

Send extraction instructions as the system prompt and the current message as user content. Instruct the model to preserve meaning, extract only stated new tasks, omit commentary, and return an empty array for messages without tasks or commands that only modify existing todos. No existing task state, earlier transcript, or tools are supplied. Catch parsing, provider, and output failures; do not forward provider exceptions or secrets to the browser.

Alternative considered: `useChat` with an `addTasks` client tool. That fits a future assistant taking several actions, but adds streaming and tool coordination to a single extraction operation. Parsing a prose response would also be less reliable than the installed schema-based output support.

### Keep a small client-owned page

Add `src/routes/todos.tsx` and a Todos link in `src/components/Header.tsx`. Use React state for todos, the manual task-title field, the visible transcript, the composer, progress, and errors. Keep the page's list and chat rendering together initially; add components only if the actual markup benefits from separation. Reuse existing styles and native labeled input, checkbox, textarea, and button controls.

Show the list and chat side by side at a wide-screen breakpoint and stack them on narrow screens. Announce processing, replies, and errors accessibly. The chat is an extraction interface with visible user messages and deterministic app replies, rather than unrestricted model-generated conversation.

Place a labeled task-title input and an Add submit button in the todo-list panel. Its form supports Enter and validates the title using the same trimmed, nonempty, 500-character title schema used by extracted and saved tasks. A valid submission creates one incomplete todo and clears the field. Invalid input stays available for correction. This local form has independent input and validation state, performs no network request, and remains usable while chat is pending or fails. Manual entries do not create chat messages.

For a successful result, validate the response in the browser and append all returned titles in one functional state update. Create each local todo as `{ id, title, completed: false }` using `crypto.randomUUID()`. Preserve existing entries and ordering. Each explicitly submitted message is independent; do not infer deduplication against older tasks or change existing ones. Duplicate titles across separate submissions are allowed.

Both manual entry and extraction append to the same current todo state and use the same storage behavior. Use functional updates for both so a delayed extraction response cannot replace tasks added manually while it was pending. Reuse the task-title schema and straightforward append logic; a separate store or service for manual tasks is unnecessary.

Place a native button showing the existing Lucide `Trash2` icon on the right of each task row, outside the checkbox label. Use red danger styling for its icon, border, and tinted background, with a red hover state and visible focus outline. Hide the decorative icon from assistive technology and give the button a task-specific deletion label and tooltip. Keep a minimum 44-pixel target and support keyboard activation on wide and narrow screens. On activation, open a styled HTML `dialog` using the page's theme colors and buttons, with the selected task's title, Cancel, and Delete task actions. Use `showModal()` for focus containment and an inert background. Focus Cancel initially; Cancel and Escape dismiss without changing the list and return focus to the invoking button. Only confirmation marks the list as changed and removes the selected ID in a functional state update. Preserve all other task identities, order, and completion states, including tasks with the same title. Reuse the existing storage effect to save the updated list, retaining its warning behavior if saving fails. Deletion makes no AI request and remains available while chat is pending or unavailable. A delayed extraction appends to the latest state without restoring a deleted task.

For a nonempty batch, show an acknowledgement listing the added tasks. For an empty batch, show a reply such as "No new tasks found. This chat extracts new tasks; use the list checkboxes to mark existing tasks complete." This explains unsupported mutation requests without adding another model-generated response field.

Use one submission handler for form and keyboard submission, with an immediate in-flight guard as well as disabled controls. Reset pending state after success or failure. On failure, keep the message visible and available for explicit retry. Do not automatically retry, append on partial responses, or claim success before validation. A failed transport request cannot mutate server-side tasks because the server only extracts; client additions happen only after a complete successful response. Ignore results after the page has unmounted.

Alternative considered: a global TanStack Store or persistence service. This feature has one page and no shared-state consumer, so local React state suffices.

### Persist only todos in browser storage

Use a dedicated key such as `hacktoberfest.todos.v1` containing the array of `{ id, title, completed }` entries. Validate stored data before restoring it. Load browser storage after mounting so server rendering never reads `window` and the initial empty state cannot overwrite a saved list. Do not write during restoration; save the resulting list only after explicit task additions, completion changes, or confirmed deletions.

Catch storage reads, JSON parsing, validation, and writes. If restoration fails, show a warning and keep an empty usable list without changing the unreadable stored value. If saving fails, retain the current in-memory todos and show that persistence is unavailable. Keep the transcript in memory only. Multiple open tabs can overwrite each other's saves; live tab synchronization is outside this release.

Alternative considered: a database and accounts. They would add deployment, authentication, and synchronization work that the confirmed browser-only scope does not require.

### Verify the contract and the workflow proportionally

Leave one small runnable assertion check using the available Node runtime and built-in assertions for request/result/stored-data validation. Cover invalid types, whitespace, limits, malformed batches, and saved completion state. Do not add a test framework.

Verify the UI with valid and failed responses: manual addition through Add and Enter, blank and oversized manual titles, manual addition without AI access and during a pending extraction, automatic append, empty results, repeated chat submit while pending, explicit retry, direct completion, reload restoration, unreadable data, failed storage writes, and narrow-screen keyboard use. Check that modification-only messages do not alter existing todos. Run the existing build and focused formatting/lint checks for touched files; document any unrelated baseline failures instead of expanding this change to fix them.

## Risks / Trade-offs

- Direct deletion removes a browser-local task without an undo feature. Require confirmation naming the selected task before changing the list; canceling preserves it.

- Extraction can be semantically wrong despite valid structure. Keep titles visible, constrain the prompt to stated tasks, and do not execute tools or alter existing todos.
- OpenAI access and the demo's model may be unavailable in the implementation environment. Handle configuration/provider errors and verify one real extraction when access exists; a provider switch would be a focused follow-up decision.
- Browser storage can be cleared, blocked, corrupted, or overwritten by another tab. Warn on read/write failures, avoid writes during initialization, and describe the browser-only limit in setup documentation.
- Automatic addition can create repeated titles when users resubmit the same task intentionally. Allow separate submissions rather than guessing whether tasks are duplicates; prevent accidental submissions during an in-flight request.
- Schema size limits can reject large dumps or responses. Report a useful error and preserve the original message so the user can shorten and retry it.

## Migration Plan

This is an additive page and endpoint. Configure the server's OpenAI key, generate the route tree with the existing command, build, and smoke-check `/todos`. No existing stored data or routes need migration. Rollback removes the added route and navigation entry; the dedicated browser storage key can remain without affecting other pages.

## Deferred capability

A later change can add chat commands to edit, complete, or remove existing tasks. That work would need task identities and current-list context, explicit mutation contracts, and safeguards for destructive commands. No tools, mutation API, or placeholders for it are introduced here.
