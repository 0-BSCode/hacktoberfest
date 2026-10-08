# Design

## Context

See `proposal.md` for motivation and `specs/task-extraction/spec.md` for the contract. The current endpoint calls TanStack AI 0.65.1 with `openaiText("gpt-4o")` and a Zod output schema. Browser code sends only the current message, validates the returned batch, and owns todo state and persistence. Existing checks mock `chat()`, so they do not test provider request serialization.

The installed OpenAI adapter 0.27.0 exports an OpenAI-compatible adapter, but its Chat Completions path unconditionally sends `stream_options.include_usage: true`. TanStack consumes upstream streams even when the endpoint returns one completed JSON object. OpenRouter's strict parameter routing can exclude providers because of that optional usage parameter.

The existing `add-chat-task-extraction` change is implemented but unarchived. It establishes the current behavioral baseline; this change uses the same capability path and adds migration requirements. It does not archive or rewrite the predecessor.

This design is included because the migration adds an external dependency and has provider compatibility and credential migration consequences.

## Goals / Non-Goals

**Goals:**

- Keep all provider configuration and model requests inside the existing endpoint.
- Preserve schema-constrained extraction through the SDK and validation at both application boundaries.
- Make model changes a server setting, with the agreed Qwen model as the default.

**Non-Goals:**

- No general provider abstraction, model picker, catalog fetching, automatic model fallback, or self-hosted inference.
- No page redesign, data migration, demo route refactor, or changes to extraction instructions.

## Decisions

### Use the dedicated TanStack OpenRouter Chat Completions adapter

Add a published `@tanstack/ai-openrouter` release compatible with the installed `@tanstack/ai` version, pinning it in the same style as the existing AI packages. Keep `chat({ outputSchema })` and replace only the endpoint's adapter construction with the package's OpenRouter text adapter. Retain the OpenAI dependency for demo routes. No core AI upgrade is planned.

Configure `modelOptions.provider.requireParameters: true` and `modelOptions.streamOptions.includeUsage: false`. The dedicated adapter omits `stream_options` when usage is disabled and serializes provider preferences to OpenRouter's wire format. Keep strict JSON Schema output; do not select JSON-only mode or parse prose as a fallback. Test the emitted request rather than only the options passed to `chat()`.

The generic installed adapter was the earlier proposed reuse option. Its forced usage parameter makes it a poor fit for required strict routing. A custom fetch wrapper or adapter override would save a dependency but introduce provider-specific request rewriting. The dedicated adapter provides the required controls directly. OpenRouter's Responses API is another option, but its beta status offers no benefit for this extraction call.

### Resolve deployment configuration in the existing handler

Continue validating input before reading provider configuration or making a model call. Trim `OPENROUTER_API_KEY`; return the existing safe HTTP 503 response when it is empty. Resolve the model as trimmed `OPENROUTER_MODEL` or `qwen/qwen3-30b-a3b-instruct-2507` when empty. Pass credentials explicitly to the adapter after the guard. Keep adapter construction inside the existing error boundary so invalid or unavailable model IDs produce a safe HTTP 502.

The model ID is trusted operator configuration, not browser input. Preserve the request schema so extra browser model fields are stripped. Use the adapter's model-name type at that server configuration boundary; model availability is checked by OpenRouter rather than a new catalog service. Operators should select open-weight models with schema-capable endpoints. The app does not infer licensing from model-name prefixes.

Do not send an automatic alternate-model list. OpenRouter may route between compatible providers serving the selected model. A failure stays recoverable through the existing Retry control rather than silently selecting a different model.

Requiring the model environment variable would create an unnecessary configuration failure for the agreed default. A hardcoded-only model would fail the model flexibility goal. Per-user credentials and a page selector would expand the scope beyond the confirmed server setting.

### Preserve the extraction and persistence boundaries

Keep the system prompt, single user message, output schema, abort propagation, whole-batch parsing, and safe error handling. `src/routes/todos.tsx` and `src/lib/todo.ts` need no implementation changes. The response remains one complete JSON object; SDK-internal streaming does not become a browser feature.

Extend the existing assertion-based test file. Retain its schema and controlled endpoint checks and add one controlled transport check using the real adapter and an intercepted SDK HTTP request, with a minimal valid provider response. This verifies the selected model, JSON Schema request, strict routing, omitted usage option, and validated endpoint result without paid network calls. Avoid a new test framework or provider wrapper.

## Risks / Trade-offs

- Provider support can change. Mitigate with required-parameter routing, full result validation, and a live smoke check of the deployed model.
- Schema compliance does not establish extraction accuracy. Check a mixed task message, a message without tasks, and a completion-only command against the actual Qwen model when credentials are available.
- Adding the dedicated adapter also adds its SDK dependency. Keep the change limited to this package and verify compatibility with the existing core AI version during installation.
- Disabling optional streamed usage data means this flow will not receive that usage breakdown. Cost reporting is outside this change; prioritize compatible schema routing.
- Operators can supply unsupported model IDs. Preserve safe HTTP 502 responses and document that configuration overrides need a schema-capable open-weight model.
- The predecessor's main specs are not yet present. When archiving later, archive `add-chat-task-extraction` first so its complete baseline precedes these additive requirements. No archive action is part of this proposal.

## Migration Plan

1. Add the compatible adapter dependency and implement the endpoint configuration and routing changes.
2. Update the controlled checks and todo extraction setup documentation. Document the new key, optional model setting, default model, and server restart requirement.
3. Run the focused checks, type check, targeted formatting/lint checks, and production build. Perform a live extraction smoke check when an OpenRouter key is available; otherwise record that provider behavior remains unverified.
4. Before deployment, configure `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` on the server. Existing demo keys remain independently configured. Restart the server and verify extraction and manual entry.
5. Roll back by reverting the dependency and endpoint changes and restoring the previous server's `OPENAI_API_KEY` configuration. Browser-saved todos require no migration or rollback.

## References

- [TanStack OpenRouter adapter and routing options](https://tanstack.com/ai/latest/docs/adapters/openrouter)
- [OpenRouter structured-output requirements](https://openrouter.ai/docs/guides/features/structured-outputs)
- [Qwen weights and license](https://huggingface.co/Qwen/Qwen3-30B-A3B-Instruct-2507)
- [Qwen provider capabilities on OpenRouter](https://openrouter.ai/api/v1/models/qwen/qwen3-30b-a3b-instruct-2507/endpoints)
