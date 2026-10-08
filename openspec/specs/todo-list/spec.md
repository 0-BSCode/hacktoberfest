# todo-list Specification

## Purpose

Provide a simple todo list that users can populate manually or from free-form messages, mark complete or delete after confirmation directly, and retain in the same browser across page reloads.

## Requirements

### Requirement: Accessible todo workspace

The system SHALL provide a `/todos` page reachable through application navigation, with a todo list, a manual task-entry form, and a task-entry chat panel. The controls SHALL have accessible labels and support keyboard use.

#### Scenario: Desktop workspace

- **WHEN** a user opens Todos on a wide screen
- **THEN** the todo list and chat panel appear beside each other
- **AND** an empty list displays an explanatory empty state

#### Scenario: Narrow workspace

- **WHEN** a user opens Todos on a narrow screen
- **THEN** the list and chat panel stack vertically without page-level horizontal overflow
- **AND** the user can add tasks manually, submit messages, and toggle todos using the keyboard

### Requirement: Manual task entry

The todo list SHALL provide a labeled task-title field and an Add button, supporting Enter to submit. A valid submission SHALL append one incomplete todo with its trimmed title and clear the field without an AI request. Manual entry SHALL remain available while chat is processing or unavailable.

#### Scenario: Add a task directly

- **GIVEN** the list contains an existing completed todo
- **WHEN** the user enters "  Buy milk  " and selects Add or presses Enter
- **THEN** one incomplete "Buy milk" todo appears at the end of the list and the field clears
- **AND** the existing todo remains completed and no AI request is sent

#### Scenario: Add without AI access

- **WHEN** the extraction service is unavailable and the user submits a valid title manually
- **THEN** the todo is added successfully without contacting the extraction service
- **AND** it is saved across reloads when browser storage is available

#### Scenario: Manual entry during extraction

- **GIVEN** a chat extraction request is pending
- **WHEN** the user manually adds "Call Mum" before the extraction succeeds
- **THEN** the manual task is added immediately
- **AND** the later extraction appends its own batch without losing or duplicating the manual task

### Requirement: Validate manually entered titles

The system SHALL reject blank or whitespace-only manual titles and titles longer than 500 characters after trimming. An invalid submission SHALL leave existing todos unchanged, retain the input for correction, and provide accessible feedback or prevent submission.

#### Scenario: Blank manual title

- **WHEN** the task-title field contains only whitespace
- **THEN** adding the task is unavailable
- **AND** no todo is added and no AI request is sent

#### Scenario: Manual title exceeds the limit

- **WHEN** the user attempts to add a title longer than 500 characters after trimming
- **THEN** submission is blocked or rejected with accessible validation feedback
- **AND** the existing list remains unchanged

### Requirement: Append extracted todos

The system SHALL append all validated titles from a successful extraction as separate incomplete todos in their returned order. Existing todos and their completion states SHALL be preserved.

#### Scenario: Add a batch to an existing list

- **GIVEN** the list contains one completed todo
- **WHEN** a successful extraction returns two task titles
- **THEN** two incomplete todos appear after the existing todo
- **AND** the existing todo remains completed

### Requirement: Direct completion control

The system SHALL allow users to mark each todo complete or incomplete directly in the list without an AI request.

#### Scenario: Toggle completion

- **WHEN** a user checks an incomplete todo and then unchecks it
- **THEN** that todo becomes complete and then incomplete
- **AND** no extraction request is sent for either action

### Requirement: Confirmed direct deletion

Each todo SHALL have a trash-icon button with red danger styling on the right side of its row, with an accessible name identifying the deletion action and task, visible keyboard focus, and keyboard support. Activating it SHALL open a confirmation dialog matching the page theme and naming the selected task before changing the list. The dialog SHALL offer Cancel and Delete task actions, initially focus Cancel, and support Escape dismissal. Only confirmation SHALL remove the selected task by its identity, preserving all other tasks, their order, and completion states. Canceling or dismissing confirmation SHALL leave the list and saved data unchanged. Deletion SHALL make no AI request and SHALL remain available while extraction is pending or unavailable.

#### Scenario: Confirm deletion of one task

- **GIVEN** the list contains two tasks with the same title and another completed task
- **WHEN** the user activates the right-side Delete button for one task and confirms
- **THEN** only the selected task identity is removed
- **AND** the other tasks retain their identities, order, and completion states
- **AND** the deleted task remains absent after reload when browser storage is available
- **AND** no extraction request is sent

#### Scenario: Cancel deletion

- **WHEN** the user activates Delete and cancels or dismisses the confirmation
- **THEN** no task is removed and saved data remains unchanged

#### Scenario: Delete during extraction

- **GIVEN** an extraction request is pending
- **WHEN** the user confirms deletion of an existing task
- **THEN** that task is removed immediately
- **AND** the later extraction appends its returned tasks to the current list without restoring the deleted task

#### Scenario: Keyboard deletion on a narrow screen

- **WHEN** the user focuses a task's Delete button using the keyboard on a narrow screen
- **THEN** the user can activate it and confirm or cancel deletion
- **AND** the row remains usable without page-level horizontal overflow

### Requirement: Browser persistence

The system SHALL retain todo titles, identities, order, and completion states across reloads in the same browser when browser storage is available. Chat messages SHALL reset on reload. Cross-browser and cross-device synchronization SHALL NOT be provided.

#### Scenario: Restore saved todos

- **GIVEN** the user has added todos and completed one
- **WHEN** the user reloads `/todos` in the same browser
- **THEN** the saved todos return in the same order and completion state
- **AND** the chat transcript starts empty

### Requirement: Recover from storage failures

The system SHALL remain usable when stored data cannot be read or saved. It SHALL warn when restoration or persistence fails, preserve the current in-memory list, and avoid overwriting stored data during failed initialization.

#### Scenario: Invalid stored data

- **WHEN** saved todo data is malformed or has an invalid shape
- **THEN** the page starts with an empty usable list and a restoration warning
- **AND** the stored value remains untouched until the user explicitly changes the list

#### Scenario: Saving is unavailable

- **WHEN** a browser storage write fails after adding, toggling, or confirming deletion of a todo
- **THEN** the current list and change remain visible for the page session
- **AND** the page warns that the change could not be saved across reloads
