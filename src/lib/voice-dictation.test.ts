import assert from "node:assert/strict";
import { mock } from "node:test";
import { Route } from "../routes/api.audio.transcribe.ts";

const handlers = Route.options.server?.handlers;
assert(handlers && typeof handlers !== "function");
const post = handlers.POST;
assert(typeof post === "function");
const call = async (
	body: BodyInit,
	headers?: HeadersInit,
	signal?: AbortSignal,
) => {
	const response = await post({
		request: new Request("http://localhost/api/audio/transcribe", {
			method: "POST",
			body,
			headers,
			signal,
		}),
	} as Parameters<typeof post>[0]);
	assert(response instanceof Response);
	return response;
};
const recording = (type = "audio/webm", size = 4) => {
	const form = new FormData();
	form.set(
		"audio",
		new File([new Uint8Array(size)], "recording.webm", { type }),
	);
	return form;
};
const originalKey = process.env.OPENROUTER_API_KEY;
const originalModel = process.env.OPENROUTER_TRANSCRIPTION_MODEL;
let calls = 0;
let providerResponse = () =>
	Response.json({ text: " Buy milk ", usage: { cost: 1 } });
let expectedModel = "openai/whisper-large-v3-turbo";
let pending = false;
let upstreamSignal: AbortSignal | undefined;
mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
	calls++;
	assert.equal(url, "https://openrouter.ai/api/v1/audio/transcriptions");
	assert.equal(
		new Headers(options.headers).get("Authorization"),
		"Bearer test-only-key",
	);
	assert.equal(new Headers(options.headers).has("Content-Type"), false);
	assert.equal(options.method, "POST");
	assert(options.body instanceof FormData);
	assert(options.body.get("file") instanceof File);
	assert.equal(options.body.get("model"), expectedModel);
	assert.equal(options.body.get("response_format"), "json");
	assert.equal(options.body.has("language"), false);
	assert.equal(options.body.has("audio"), false);
	upstreamSignal = options.signal as AbortSignal;
	assert(upstreamSignal instanceof AbortSignal);
	upstreamSignal.throwIfAborted();
	if (pending)
		return new Promise<Response>((_resolve, reject) => {
			upstreamSignal?.addEventListener(
				"abort",
				() => reject(new Error("private provider detail")),
				{ once: true },
			);
		});
	return providerResponse();
});
try {
	delete process.env.OPENROUTER_API_KEY;
	delete process.env.OPENROUTER_TRANSCRIPTION_MODEL;
	const duplicate = recording();
	duplicate.append(
		"audio",
		new File(["second"], "second.webm", { type: "audio/webm" }),
	);
	const notFile = new FormData();
	notFile.set("audio", "text");
	for (const body of [
		"broken",
		new FormData(),
		notFile,
		duplicate,
		recording("text/plain"),
		recording("audio/webm", 0),
	]) {
		assert.equal((await call(body)).status, 400);
	}
	assert.equal(
		(await call(recording("audio/webm", 10 * 1024 * 1024 + 1))).status,
		413,
	);
	for (const length of [undefined, "1"]) {
		const headers: Record<string, string> = {
			"Content-Type": "multipart/form-data; boundary=test",
		};
		if (length) headers["Content-Length"] = length;
		assert.equal(
			(await call(new Uint8Array(11 * 1024 * 1024 + 1), headers)).status,
			413,
		);
	}
	assert.equal(calls, 0);
	assert.equal((await call(recording())).status, 503);
	process.env.OPENROUTER_API_KEY = "   ";
	assert.equal((await call(recording())).status, 503);
	assert.equal(calls, 0);
	process.env.OPENROUTER_API_KEY = "  test-only-key  ";
	for (const type of [
		"audio/webm;codecs=opus",
		"audio/ogg",
		"audio/mp4",
		"audio/m4a",
		"audio/x-m4a",
		"audio/wav",
		"audio/x-wav",
	]) {
		assert.deepEqual(await (await call(recording(type))).json(), {
			text: "Buy milk",
		});
	}
	assert.equal(
		(await call(recording("audio/webm", 10 * 1024 * 1024))).status,
		200,
	);
	process.env.OPENROUTER_TRANSCRIPTION_MODEL = "  ";
	assert.equal((await call(recording())).status, 200);
	process.env.OPENROUTER_TRANSCRIPTION_MODEL = " openai/whisper-large-v3 ";
	expectedModel = "openai/whisper-large-v3";
	const overridden = recording();
	overridden.set("model", "untrusted");
	overridden.set("language", "untrusted");
	assert.equal((await call(overridden)).status, 200);
	providerResponse = () => Response.json({ text: "  " });
	assert.deepEqual(await (await call(recording())).json(), { text: "" });
	providerResponse = () => Response.json({ text: "a".repeat(10_000) });
	assert.equal((await call(recording())).status, 200);
	for (const result of [null, {}, { text: 42 }, { text: "a".repeat(10_001) }]) {
		providerResponse = () => Response.json(result);
		assert.equal((await call(recording())).status, 502);
	}
	for (const response of [
		new Response("invalid JSON"),
		Response.json({ error: "test-only-key" }, { status: 429 }),
	]) {
		providerResponse = () => response;
		const result = await call(recording());
		assert.equal(result.status, 502);
		assert(!JSON.stringify(await result.json()).includes("test-only-key"));
	}
	pending = true;
	upstreamSignal = undefined;
	const controller = new AbortController();
	const cancelled = call(recording(), undefined, controller.signal);
	while (!upstreamSignal) await new Promise((resolve) => setImmediate(resolve));
	controller.abort();
	assert.equal((await cancelled).status, 502);
	assert((upstreamSignal as AbortSignal).aborted);
	upstreamSignal = undefined;
	mock.timers.enable({ apis: ["setTimeout"] });
	const timedOut = call(recording());
	while (!upstreamSignal) await new Promise((resolve) => setImmediate(resolve));
	mock.timers.tick(59_999);
	assert.equal((upstreamSignal as AbortSignal).aborted, false);
	mock.timers.tick(1);
	assert.equal((await timedOut).status, 502);
	assert((upstreamSignal as AbortSignal).aborted);
	mock.timers.reset();
} finally {
	if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
	else process.env.OPENROUTER_API_KEY = originalKey;
	if (originalModel === undefined)
		delete process.env.OPENROUTER_TRANSCRIPTION_MODEL;
	else process.env.OPENROUTER_TRANSCRIPTION_MODEL = originalModel;
	mock.restoreAll();
	mock.timers.reset();
}
console.log(
	"Voice dictation request, transcript, and cancellation checks passed.",
);
