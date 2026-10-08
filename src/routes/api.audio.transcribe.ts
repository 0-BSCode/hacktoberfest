import { Buffer } from "node:buffer";
import { createFileRoute } from "@tanstack/react-router";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MAX_BODY_BYTES = 11 * 1024 * 1024;
const AUDIO_TYPES = new Set([
	"audio/webm",
	"audio/ogg",
	"audio/mp4",
	"audio/m4a",
	"audio/x-m4a",
	"audio/wav",
	"audio/x-wav",
]);

export const Route = createFileRoute("/api/audio/transcribe")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				let audio: File;
				const reader = request.body?.getReader();
				if (!reader) {
					return Response.json(
						{ error: "Record some audio first." },
						{ status: 400 },
					);
				}
				try {
					const chunks: Uint8Array[] = [];
					let size = 0;
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						size += value.byteLength;
						if (size > MAX_BODY_BYTES) {
							await reader.cancel();
							return Response.json(
								{ error: "Recording is too large. Keep it under 10 MiB." },
								{ status: 413 },
							);
						}
						chunks.push(value);
					}
					const form = await new Response(Buffer.concat(chunks), {
						headers: {
							"Content-Type": request.headers.get("Content-Type") || "",
						},
					}).formData();
					const files = form.getAll("audio");
					const file = files[0];
					if (
						files.length !== 1 ||
						!(file instanceof File) ||
						!file.size ||
						!AUDIO_TYPES.has(file.type.split(";")[0].toLowerCase())
					) {
						return Response.json(
							{
								error:
									"Upload one nonempty WebM, Ogg, MP4, M4A, or WAV recording.",
							},
							{ status: 400 },
						);
					}
					if (file.size > MAX_AUDIO_BYTES) {
						return Response.json(
							{ error: "Recording is too large. Keep it under 10 MiB." },
							{ status: 413 },
						);
					}
					audio = file;
				} catch {
					return Response.json(
						{ error: "Couldn't read the recording. Please record again." },
						{ status: 400 },
					);
				} finally {
					reader.releaseLock();
				}

				const apiKey = process.env.OPENROUTER_API_KEY?.trim();
				if (!apiKey) {
					return Response.json(
						{ error: "Voice dictation is unavailable. You can still type." },
						{ status: 503 },
					);
				}
				const controller = new AbortController();
				const abort = () => controller.abort();
				request.signal.addEventListener("abort", abort, { once: true });
				if (request.signal.aborted) abort();
				const timer = setTimeout(abort, 60_000);
				try {
					const form = new FormData();
					form.set("file", audio, audio.name);
					form.set(
						"model",
						process.env.OPENROUTER_TRANSCRIPTION_MODEL?.trim() ||
							"openai/whisper-large-v3-turbo",
					);
					form.set("response_format", "json");
					const response = await fetch(
						"https://openrouter.ai/api/v1/audio/transcriptions",
						{
							method: "POST",
							headers: { Authorization: `Bearer ${apiKey}` },
							body: form,
							signal: controller.signal,
						},
					);
					if (!response.ok) throw new Error("Transcription failed");
					const result: unknown = await response.json();
					if (
						!result ||
						typeof result !== "object" ||
						!("text" in result) ||
						typeof result.text !== "string" ||
						result.text.trim().length > 10_000
					) {
						throw new Error("Invalid transcript");
					}
					controller.signal.throwIfAborted();
					return Response.json({ text: result.text.trim() });
				} catch {
					return Response.json(
						{
							error:
								"Couldn't transcribe the recording. Please record again or type.",
						},
						{ status: 502 },
					);
				} finally {
					clearTimeout(timer);
					request.signal.removeEventListener("abort", abort);
				}
			},
		},
	},
});
