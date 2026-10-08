# Tasks

## 1. Adapter dependency

- [x] 1.1 Add and pin a published `@tanstack/ai-openrouter` version compatible with the existing `@tanstack/ai` 0.65.1, retaining the OpenAI dependency for demos; verify successful installation, compatible peer requirements, and the presence of strict-routing and usage controls in the installed adapter.

## 2. Extraction migration

- [x] 2.1 Update `src/routes/api.tasks.extract.ts` to use the dedicated OpenRouter text adapter, trimmed `OPENROUTER_API_KEY`, and trimmed `OPENROUTER_MODEL` with the agreed Qwen default; preserve input-first validation, abort propagation, full result parsing, and safe errors. Verify with controlled endpoint checks for missing and whitespace-only keys, an OpenAI-only key, unset and whitespace-only model defaults, a model override, and an ignored browser model field.
- [x] 2.2 Require schema-capable provider routing and disable optional streamed usage, retaining the task output schema and omitting alternate-model fallbacks; verify an intercepted real adapter request contains the configured model, strict JSON Schema task output, and `provider.require_parameters: true`, without `stream_options` or an alternate-model list.
- [x] 2.3 Extend `src/lib/todo.test.ts` with the configuration and transport checks above, restoring changed environment values and mocks afterward. Retain checks for invalid input, valid and empty batches, invalid output, and safe provider errors; verify `node --experimental-test-module-mocks src/lib/todo.test.ts` passes on Node 24 without external network access.
- [x] 2.4 Update the todo extraction section of `README.md` with the new server key, optional model setting, Qwen default, open-weight and schema-support expectations for overrides, server restart, and unchanged API/error contract; verify examples match the endpoint and clearly distinguish todo configuration from existing demo credentials.

## 3. Integration verification

- [x] 3.1 Run the focused extraction checks, targeted Biome checks, `pnpm exec tsc --noEmit`, and `pnpm build`; verify the migration introduces no new failures and record any unrelated existing failures with evidence. Smoke-check `/todos` for successful addition, safe failure/retry, manual entry during AI unavailability, and retained saved tasks.
- [x] 3.2 When an OpenRouter key is available, run live Qwen extraction for a mixed task message, a message with no tasks, and a completion-only command; verify expected task titles or empty batches and whole-batch validation. If credentials are unavailable, record the live verification limitation explicitly rather than claiming model accuracy or live compatibility was tested.

## Verification (2026-10-08)

- Focused checks passed: `node --experimental-test-module-mocks src/lib/todo.test.ts`. Provider requests were intercepted locally; no external model calls were made. Checks cover configuration, real adapter request serialization, strict schema routing, valid/empty batches, whole-batch rejection, and safe provider errors.
- Targeted Biome checks and `git diff --check` passed. `pnpm build` passed with existing bundler warnings about dependency `use client` directives.
- `pnpm exec tsc --noEmit` reports the same six errors before and after the migration (the captured output comparison was empty): two event-name errors in `src/lib/demo-store-devtools.tsx` at lines 25 and 40; unused `useEffect` in `src/routes/demo/ai-image.tsx` at line 1; provider-map indexing in `src/routes/demo/api.ai.chat.ts` at line 68; missing image prompt in `src/routes/demo/api.ai.image.ts` at line 37; and the guitar route path in `src/routes/demo/guitars/$guitarId.tsx` at line 23. No new TypeScript errors were introduced.
- Browser smoke checks used the running app through a temporary local proxy. The first extraction reached the real endpoint without a key and showed the safe unavailable message and Retry. Manual entry still appended a task. Retry received a controlled successful batch and appended both titles while preserving existing tasks and completion state. All 11 tasks, including the manual task and extracted batch, survived reload. The temporary proxy was stopped afterward.
- Neither the server shell nor `.env.local` has a configured `OPENROUTER_API_KEY`. Live Qwen mixed-task, no-task, and completion-only cases were not run. Model accuracy and current live provider compatibility remain unverified; configure the key and restart the server to perform these checks.
