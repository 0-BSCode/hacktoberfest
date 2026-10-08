import assert from "node:assert/strict";
import { mock } from "node:test";
import {
	ExtractionRequestSchema,
	ExtractionResultSchema,
	SavedTodosSchema,
	TaskTitleSchema,
} from "./todo.ts";

assert.equal(TaskTitleSchema.parse("  Buy milk  "), "Buy milk");
assert.equal(TaskTitleSchema.parse("a".repeat(500)).length, 500);
for (const title of ["", "  ", 42, "a".repeat(501)]) {
	assert.equal(TaskTitleSchema.safeParse(title).success, false);
}
assert.deepEqual(ExtractionRequestSchema.parse({ message: "  Buy milk  " }), {
	message: "Buy milk",
});
assert.equal(
	ExtractionRequestSchema.safeParse({ message: "a".repeat(10_000) }).success,
	true,
);
for (const message of [null, 42, "", "  ", "a".repeat(10_001)]) {
	assert.equal(ExtractionRequestSchema.safeParse({ message }).success, false);
}
assert.equal(ExtractionRequestSchema.safeParse({}).success, false);
assert.deepEqual(ExtractionResultSchema.parse({ tasks: [] }), { tasks: [] });
assert.deepEqual(
	ExtractionResultSchema.parse({ tasks: [" Buy milk ", "Call Mum"] }),
	{ tasks: ["Buy milk", "Call Mum"] },
);
assert.equal(
	ExtractionResultSchema.safeParse({ tasks: Array(50).fill("Task") }).success,
	true,
);
for (const tasks of [
	null,
	"Task",
	["Valid", "  "],
	[42],
	Array(51).fill("Task"),
]) {
	assert.equal(ExtractionResultSchema.safeParse({ tasks }).success, false);
}
const saved = [{ id: crypto.randomUUID(), title: "Buy milk", completed: true }];
assert.deepEqual(
	SavedTodosSchema.parse(JSON.parse(JSON.stringify(saved))),
	saved,
);
assert.equal(SavedTodosSchema.safeParse([...saved, ...saved]).success, false);
assert.equal(
	SavedTodosSchema.safeParse([{ ...saved[0], completed: "yes" }]).success,
	false,
);
assert.equal(
	SavedTodosSchema.safeParse([{ ...saved[0], id: "invalid" }]).success,
	false,
);
assert.throws(() => JSON.parse("broken storage"));
let modelCalls = 0;
const ai = await import("@tanstack/ai");
const defaultModel = "qwen/qwen3-30b-a3b-instruct-2507";
let expectedModel = defaultModel;
let useProvider = false;
let modelResult: unknown = {
	tasks: ["Buy milk", "Submit the presentation", "Call Mum"],
};
mock.module("@tanstack/ai", {
	namedExports: {
		...ai,
		chat: async (options: Parameters<typeof ai.chat>[0]) => {
			modelCalls++;
			assert.equal(options.messages?.length, 1);
			assert.equal(options.messages?.[0].role, "user");
			const prompt = options.systemPrompts?.[0];
			assert.equal(typeof prompt, "string");
			assert.match(prompt as string, /edit, complete, or remove/);
			assert.equal(options.tools, undefined);
			assert.equal(options.adapter.name, "openrouter");
			assert.equal(options.adapter.model, expectedModel);
			if (useProvider) return ai.chat(options);
			if (modelResult instanceof Error) throw modelResult;
			return modelResult;
		},
	},
});
const { Route } = await import("../routes/api.tasks.extract.ts");
const handlers = Route.options.server?.handlers;
assert(handlers && typeof handlers !== "function");
const post = handlers.POST;
assert(typeof post === "function");
const call = async (body: string) => {
	const response = await post({
		request: new Request("http://localhost/api/tasks/extract", {
			method: "POST",
			body,
		}),
	} as Parameters<typeof post>[0]);
	assert(response instanceof Response);
	return response;
};
const originalEnv = {
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
	OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
};
const providerRequests: Request[] = [];
let providerContent = JSON.stringify({ tasks: [" Buy milk "] });
let providerStatus = 200;
mock.method(
	globalThis,
	"fetch",
	async (input: RequestInfo | URL, init?: RequestInit) => {
		assert(useProvider, "Unexpected provider network call");
		const request = new Request(input, init);
		providerRequests.push(request.clone());
		if (providerStatus !== 200) {
			return Response.json(
				{
					error: {
						message: "Provider secret test-only-key",
						code: providerStatus,
					},
				},
				{ status: providerStatus },
			);
		}
		const { model, stream } = await request.json();
		const choice = { index: 0, finish_reason: "stop" };
		const result = {
			id: "test-completion",
			created: 0,
			model,
			object: stream ? "chat.completion.chunk" : "chat.completion",
			choices: [
				{
					...choice,
					...(stream
						? { delta: { role: "assistant", content: providerContent } }
						: { message: { role: "assistant", content: providerContent } }),
				},
			],
		};
		return stream
			? new Response(`data: ${JSON.stringify(result)}\n\ndata: [DONE]\n\n`, {
					headers: { "Content-Type": "text/event-stream" },
				})
			: Response.json(result);
	},
);
try {
	delete process.env.OPENROUTER_MODEL;
	process.env.OPENAI_API_KEY = "old-provider-only-key";
	for (const key of [undefined, "  "]) {
		if (key === undefined) delete process.env.OPENROUTER_API_KEY;
		else process.env.OPENROUTER_API_KEY = key;
		assert.equal(
			(await call(JSON.stringify({ message: "Buy milk" }))).status,
			503,
		);
		assert.equal((await call("{")).status, 400);
	}
	assert.equal(modelCalls, 0);
	process.env.OPENROUTER_API_KEY = "  test-only-key  ";
	for (const body of [
		"{",
		"null",
		"{}",
		'{"message":42}',
		'{"message":"  "}',
		JSON.stringify({ message: "a".repeat(10_001) }),
	]) {
		assert.equal((await call(body)).status, 400);
	}
	assert.equal(modelCalls, 0);
	const success = await call(
		JSON.stringify({
			message: "Buy milk, submit the presentation, and call Mum",
		}),
	);
	assert.equal(success.status, 200);
	assert.deepEqual(await success.json(), modelResult);
	process.env.OPENROUTER_MODEL = "  ";
	assert.equal(
		(
			await call(
				JSON.stringify({ message: "Buy milk", model: "browser-model" }),
			)
		).status,
		200,
	);
	expectedModel = "openai/gpt-oss-20b";
	process.env.OPENROUTER_MODEL = `  ${expectedModel}  `;
	assert.equal(
		(await call(JSON.stringify({ message: "Buy milk" }))).status,
		200,
	);
	modelResult = { tasks: [] };
	assert.deepEqual(
		await (
			await call(JSON.stringify({ message: "Mark the milk task done" }))
		).json(),
		{ tasks: [] },
	);
	for (const invalid of [
		{ tasks: ["Valid", " "] },
		{ tasks: "wrong" },
		new Error("Provider secret test-only-key"),
	]) {
		modelResult = invalid;
		const failed = await call(JSON.stringify({ message: "Buy milk" }));
		assert.equal(failed.status, 502);
		const body = await failed.text();
		assert.doesNotMatch(body, /Provider secret|test-only-key|Valid/);
	}
	delete process.env.OPENROUTER_MODEL;
	expectedModel = defaultModel;
	useProvider = true;
	const transported = await call(
		JSON.stringify({ message: "Buy milk", model: "browser-model" }),
	);
	assert.equal(transported.status, 200);
	assert.deepEqual(await transported.json(), { tasks: ["Buy milk"] });
	assert.equal(providerRequests.length, 1);
	const request = providerRequests[0];
	assert.equal(request.url, "https://openrouter.ai/api/v1/chat/completions");
	assert.equal(request.headers.get("Authorization"), "Bearer test-only-key");
	const body = await request.json();
	assert.equal(body.model, defaultModel);
	assert.equal(body.provider.require_parameters, true);
	assert.equal(body.response_format.type, "json_schema");
	assert.equal(body.response_format.json_schema.strict, true);
	assert.equal(
		body.response_format.json_schema.schema.properties.tasks.type,
		"array",
	);
	assert.equal(body.stream_options, undefined);
	assert.equal(body.models, undefined);
	assert.equal(body.tools, undefined);
	assert.equal(body.messages.length, 2);
	assert.deepEqual(body.messages[1], { role: "user", content: "Buy milk" });
	for (const content of ["not JSON", '{"tasks":["Valid"," "]}']) {
		providerContent = content;
		assert.equal(
			(await call(JSON.stringify({ message: "Buy milk" }))).status,
			502,
		);
	}
	providerStatus = 404;
	const unavailable = await call(JSON.stringify({ message: "Buy milk" }));
	assert.equal(unavailable.status, 502);
	assert.doesNotMatch(
		await unavailable.text(),
		/Provider secret|test-only-key/,
	);
	assert.equal(providerRequests.length, 4);
} finally {
	for (const [name, value] of Object.entries(originalEnv)) {
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	}
	mock.restoreAll();
}
console.log("Todo schema and extraction endpoint checks passed.");
