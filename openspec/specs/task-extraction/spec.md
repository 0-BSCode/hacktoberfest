# task-extraction Specification

## Purpose

Turn an individual free-form message into a validated batch of actionable task titles and add them to the todo list with clear feedback for success, empty results, and failures.

## Requirements

### Requirement: Extract tasks from a submitted message

The system SHALL extract concise task titles explicitly supported by the current message. It SHALL handle multiple tasks, preserve the user's meaning, and return an empty task batch when no actionable tasks are present. Earlier chat messages SHALL NOT be reprocessed.

#### Scenario: Extract a mixed message

- **WHEN** the user submits "I'm tired. I need to buy milk, submit the presentation, and call Mum."
- **THEN** the system extracts the three stated tasks
- **AND** it does not create a task from "I'm tired"

#### Scenario: Independent messages

- **GIVEN** an earlier message already added "Buy milk"
- **WHEN** the user submits "Call Mum"
- **THEN** the new request extracts tasks only from "Call Mum"
- **AND** it does not add the earlier milk task again

### Requirement: Validate extraction requests

The system SHALL reject malformed requests, non-string messages, blank messages, and messages longer than 10,000 characters before invoking the model. Whitespace-only input SHALL also be blocked by the chat form.

#### Scenario: Invalid request

- **WHEN** a request contains invalid JSON, a non-string message, or a message exceeding the supported limit
- **THEN** the extraction endpoint returns a client error
- **AND** no model call occurs and no todos change

#### Scenario: Blank submission

- **WHEN** the chat composer contains only whitespace
- **THEN** submission is unavailable
- **AND** no extraction request occurs

### Requirement: Apply only a complete validated result

The system SHALL automatically append a successful extraction without a confirmation step. A result SHALL contain no more than 50 nonempty task titles of at most 500 characters each. The system SHALL reject an invalid batch as a whole and SHALL NOT add partial output.

#### Scenario: Successful batch

- **WHEN** extraction returns a complete valid batch of three titles
- **THEN** the list receives those three todos once
- **AND** the chat displays an acknowledgement identifying the added tasks

#### Scenario: Invalid model output

- **WHEN** the model response has the wrong shape, a blank title, or exceeds an output limit
- **THEN** the request is reported as failed
- **AND** the todo list remains unchanged

### Requirement: Empty-result feedback

The system SHALL show a no-tasks-found reply when extraction succeeds with an empty batch, without changing the list.

#### Scenario: Message without tasks

- **WHEN** the user submits "I'm feeling overwhelmed" and extraction finds no tasks
- **THEN** the chat explains that no tasks were found
- **AND** existing todos remain unchanged

### Requirement: Visible progress and single submission

The chat panel SHALL display submitted messages and extraction progress, allow at most one extraction request in flight, and prevent repeated submit actions from dispatching that pending message again.

#### Scenario: Submit while processing

- **WHEN** the user submits a message and immediately tries to submit again
- **THEN** only one request is dispatched
- **AND** the chat shows a processing state until the request settles

### Requirement: Recoverable extraction failures

The system SHALL show a useful error when extraction is unavailable or fails. It SHALL preserve existing todos and the submitted message, allow an explicit retry, and avoid claiming that tasks were added.

#### Scenario: Provider or network failure

- **WHEN** the provider is unconfigured, the provider call fails, or the network request fails
- **THEN** the chat displays an error and lets the user retry the failed message
- **AND** existing todos remain unchanged
- **AND** a successful retry adds the returned batch once

### Requirement: Extraction-only chat behavior

The chat SHALL NOT edit, complete, or remove existing todos. Commands aimed only at modifying existing todos SHALL produce an empty task batch and explain that this version only extracts new tasks.

#### Scenario: Completion command

- **GIVEN** the list contains an incomplete "Buy milk" todo
- **WHEN** the user submits "Mark the milk task done"
- **THEN** no new todo is added and the existing todo stays incomplete
- **AND** the chat explains the extraction-only scope

### Requirement: Server-side model access

The system SHALL keep model credentials on the server and SHALL return only validated task data or a safe error to the browser. Model requests SHALL receive only the current message and extraction instructions, with no access to existing todo mutation actions.

#### Scenario: Request boundary

- **WHEN** the browser submits a message for extraction
- **THEN** it calls the application's extraction endpoint without receiving provider credentials
- **AND** the model call contains no todo-editing tools or existing todo state
