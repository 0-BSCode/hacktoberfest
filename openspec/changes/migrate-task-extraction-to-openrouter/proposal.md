# Proposal

## Why

Todo extraction currently hardcodes OpenAI's `gpt-4o`. Moving it to OpenRouter lets the operator choose an open-weight model through server configuration while keeping the existing todo workflow.

## What Changes

- Route todo extraction through OpenRouter with server-only credentials.
- Add `OPENROUTER_MODEL`, defaulting to `qwen/qwen3-30b-a3b-instruct-2507`, the agreed initial open-weight model.
- Require schema-capable upstream providers and retain validation of every complete task batch.
- Preserve the extraction endpoint's JSON contract, single-message scope, safe errors, manual entry, and browser persistence.
- **BREAKING**: Todo extraction requires `OPENROUTER_API_KEY`; an `OPENAI_API_KEY` alone will no longer enable it.
- Update extraction setup documentation and controlled checks for configuration, routing, and provider failures.

## Capabilities

### New Capabilities

- `task-extraction`: Add requirements for OpenRouter access, server-configured model selection, and schema-capable provider routing. This reuses the capability path from the implemented `add-chat-task-extraction` change, whose baseline has not yet been archived into main specs. The delta adds only new requirements rather than repeating that baseline.

### Modified Capabilities

None. The main capability inventory is empty; the existing task-extraction behavior is defined in the completed predecessor change.

## Impact

- Implementation targets `src/routes/api.tasks.extract.ts`, `src/lib/todo.test.ts`, and the todo extraction section of `README.md`.
- Add a compatible release of `@tanstack/ai-openrouter` and update `package.json` and `pnpm-lock.yaml`. Keep the OpenAI package for existing demo routes.
- Replace direct OpenAI access for this endpoint with OpenRouter-hosted inference. The selected model has downloadable weights; local hosting is outside scope.
- No page selector, model discovery service, agent tools, database, or changes to demo provider selection are needed.
