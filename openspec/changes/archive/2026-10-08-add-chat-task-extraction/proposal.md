# Proposal

## Why

Users need a simple todo list with both direct task entry and a way to turn a messy dump of things to do into individual tasks. The app already demonstrates AI structured output, which can support the optional chat workflow using its existing dependencies.

## What Changes

- Add a `/todos` page with a simple todo list and a chat panel beside it on wide screens, stacked on narrow screens.
- Add a task-title field and Add button in the list so users can enter tasks directly without AI, including when chat is processing or unavailable.
- Extract task titles from each submitted message and automatically append them as incomplete todos after a successful, validated response.
- Allow users to check and uncheck todos directly in the list.
- Add a trash-icon button with red danger styling on the right of each todo. Ask for confirmation in a themed dialog before removing the selected task and saving the updated list.
- Save todos and completion state in this browser so they survive reloads; keep the chat transcript only for the current page session.
- Show extraction progress, an explicit no-tasks-found response, and recoverable errors without losing the message or existing tasks.
- Keep chat focused on extraction and addition, with direct completion and confirmed deletion in the list. Note chat commands to edit, complete, or remove existing tasks as future work. Dates, priorities, accounts, cross-device sync, and background agents are outside this change.

## Capabilities

### New Capabilities

- `todo-list`: A responsive todo page with manual task entry, locally stored task titles, directly controlled completion state, and confirmed task deletion.
- `task-extraction`: Convert an individual free-form message into validated task titles, append them automatically, and report success, empty results, or failure through the chat panel.

### Modified Capabilities

None. The project currently has no main capability specs.

## Impact

- Add a page route, a structured extraction API route, and a small shared task schema using the existing TanStack Start, TanStack AI, React, and Zod dependencies.
- Add a Todos navigation link using the existing header and reuse the current styling tokens.
- Use the existing OpenAI structured-output integration as the proposed initial provider, with server-side credentials. Provider choice is a proposed implementation default, not a user-selected requirement.
- Store todos in browser local storage. No database, new package, or shared chat/tool framework is needed.
- Update setup documentation for the extraction endpoint. Existing demo routes retain their behavior.
