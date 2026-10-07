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
let modelResult: unknown = {
	tasks: ["Buy milk", "Submit the presentation", "Call Mum"],
};
mock.module("@tanstack/ai", {
	namedExports: {
		...(await import("@tanstack/ai")),
		chat: async (options: {
			messages: { role: string; content: string }[];
			systemPrompts: string[];
			tools?: unknown;
		}) => {
			modelCalls++;
			assert.equal(options.messages.length, 1);
			assert.equal(options.messages[0].role, "user");
			assert.match(options.systemPrompts[0], /edit, complete, or remove/);
			assert.equal(options.tools, undefined);
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
const originalKey = process.env.OPENAI_API_KEY;
try {
	delete process.env.OPENAI_API_KEY;
	assert.equal(
		(await call(JSON.stringify({ message: "Buy milk" }))).status,
		503,
	);
	assert.equal(modelCalls, 0);
	process.env.OPENAI_API_KEY = "test-only-key";
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
} finally {
	if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
	else process.env.OPENAI_API_KEY = originalKey;
	mock.restoreAll();
}
console.log("Todo schema and extraction endpoint checks passed.");
