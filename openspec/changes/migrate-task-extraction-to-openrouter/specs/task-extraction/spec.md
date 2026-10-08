# Spec Delta

## Purpose

Convert individual free-form messages into validated task titles, with OpenRouter access and model selection controlled by server configuration.

## ADDED Requirements

### Requirement: OpenRouter extraction credentials

The system SHALL use a server-only `OPENROUTER_API_KEY` for todo extraction through OpenRouter. A missing or whitespace-only key SHALL produce HTTP 503 for a valid extraction request without calling a model. An `OPENAI_API_KEY` alone SHALL NOT enable todo extraction. Credentials SHALL NOT appear in browser responses.

#### Scenario: OpenRouter key configured

- **GIVEN** a valid OpenRouter key is configured on the server
- **WHEN** a valid extraction request is submitted
- **THEN** model access uses OpenRouter with that key
- **AND** the browser receives only validated task data or a safe error

#### Scenario: Only the previous provider key exists

- **GIVEN** `OPENAI_API_KEY` is configured but `OPENROUTER_API_KEY` is missing or whitespace-only
- **WHEN** a valid extraction request is submitted
- **THEN** the endpoint returns HTTP 503 without a model call
- **AND** manual task entry remains available

### Requirement: Server-configured extraction model

The system SHALL select its model from the trimmed server setting `OPENROUTER_MODEL`, using `qwen/qwen3-30b-a3b-instruct-2507` when the setting is unset or whitespace-only. The initial model SHALL be open-weight. Model choice SHALL NOT be exposed as a page control or accepted from browser request fields. The system SHALL NOT automatically fall back to another model.

#### Scenario: Default open-weight model

- **GIVEN** the OpenRouter key is configured and the model setting is unset or whitespace-only
- **WHEN** the server processes a valid extraction request
- **THEN** it requests `qwen/qwen3-30b-a3b-instruct-2507`

#### Scenario: Operator selects another model

- **GIVEN** the operator configures another supported open-weight model ID with surrounding whitespace
- **WHEN** the server processes a valid extraction request
- **THEN** it requests that trimmed model ID without requiring a page change

#### Scenario: Browser attempts to choose a model

- **WHEN** an extraction request includes a model field alongside its message
- **THEN** the server uses its configured model and does not forward the browser's model field

### Requirement: Schema-capable provider routing

The system SHALL request schema-constrained task output and restrict OpenRouter routing to provider endpoints that support the required request parameters. It SHALL NOT downgrade to unconstrained text when no compatible endpoint is available. Optional usage reporting SHALL NOT prevent routing to an otherwise compatible schema-capable endpoint.

#### Scenario: Multiple providers for the selected model

- **GIVEN** providers for the selected model differ in structured-output support
- **WHEN** extraction is requested
- **THEN** only endpoints that support the required schema parameters are eligible

#### Scenario: No compatible endpoint

- **GIVEN** OpenRouter cannot serve the selected model with the required schema parameters
- **WHEN** extraction is requested
- **THEN** the endpoint returns HTTP 502 with a safe retryable error
- **AND** no unconstrained-text or alternate-model request is attempted

### Requirement: Preserve the task extraction contract across providers

The endpoint SHALL retain `POST /api/tasks/extract`, the `{ message: string }` request, and complete `{ tasks: string[] }` responses. It SHALL retain the 10,000-character message limit, 50-title batch limit, and trimmed 1-to-500-character titles. HTTP 400 SHALL reject invalid input before model access; HTTP 502 SHALL cover provider or output failures without adding tasks or exposing provider exceptions.

#### Scenario: Valid OpenRouter result

- **WHEN** OpenRouter returns a valid task batch for the current message
- **THEN** the browser appends those titles as incomplete todos using the existing persistence flow
- **AND** existing todos and completion states are preserved

#### Scenario: Invalid provider output

- **WHEN** the provider returns malformed JSON, an invalid task batch, or an error
- **THEN** the endpoint returns HTTP 502 without returning any partial task batch
- **AND** the browser preserves existing tasks and offers retry

#### Scenario: Invalid request with missing configuration

- **GIVEN** the OpenRouter key is missing
- **WHEN** the request contains malformed JSON or an invalid message
- **THEN** the endpoint returns HTTP 400 without invoking a model

#### Scenario: Independent extraction remains unchanged

- **WHEN** the user submits a message after earlier messages have added tasks
- **THEN** only the current message and extraction instructions are sent to the model
- **AND** no existing todos, prior transcript, or todo mutation tools are supplied
