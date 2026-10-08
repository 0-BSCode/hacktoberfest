import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "starting" | "recording" | "transcribing";
type Session = {
	stream?: MediaStream;
	recorder?: MediaRecorder;
	chunks: Blob[];
	size: number;
	controller: AbortController;
	timer?: ReturnType<typeof setTimeout>;
};
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function release(session: Session) {
	clearTimeout(session.timer);
	session.stream?.getTracks().forEach((track) => {
		track.stop();
	});
}

export function useAudioRecorder({
	endpoint = "/demo/api/ai/transcription",
	onTranscript,
}: {
	endpoint?: string;
	onTranscript: (text: string) => void;
}) {
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const sessionRef = useRef<Session | null>(null);
	const callbackRef = useRef(onTranscript);
	useEffect(() => {
		callbackRef.current = onTranscript;
	}, [onTranscript]);

	const discard = useCallback(() => {
		const session = sessionRef.current;
		sessionRef.current = null;
		if (!session) return;
		session.controller.abort();
		release(session);
		if (session.recorder?.state === "recording") session.recorder.stop();
		session.chunks = [];
	}, []);

	useEffect(() => discard, [discard]);

	function cancelRecording() {
		discard();
		setStatus("idle");
		setError("");
		setNotice("Recording cancelled. You can still type.");
	}

	function fail(session: Session, message: string) {
		if (sessionRef.current !== session) return;
		discard();
		setStatus("idle");
		setError(message);
		setNotice("");
	}

	function stopRecording() {
		const session = sessionRef.current;
		if (!session || session.recorder?.state !== "recording") return;
		setStatus("transcribing");
		clearTimeout(session.timer);
		session.recorder.stop();
		release(session);
	}

	async function startRecording() {
		if (sessionRef.current) return;
		setError("");
		setNotice("");
		if (
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === "undefined"
		) {
			setError("Voice recording isn't supported here. You can still type.");
			return;
		}
		const mimeType = [
			"audio/webm;codecs=opus",
			"audio/ogg;codecs=opus",
			"audio/mp4;codecs=mp4a.40.2",
			"audio/mp4",
		].find((type) => MediaRecorder.isTypeSupported(type));
		if (!mimeType) {
			setError(
				"This browser has no supported recording format. You can still type.",
			);
			return;
		}
		const session: Session = {
			chunks: [],
			size: 0,
			controller: new AbortController(),
		};
		sessionRef.current = session;
		setStatus("starting");
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (sessionRef.current !== session) {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
				return;
			}
			session.stream = stream;
			const recorder = new MediaRecorder(stream, { mimeType });
			session.recorder = recorder;
			recorder.ondataavailable = (event) => {
				if (sessionRef.current !== session || !event.data.size) return;
				session.size += event.data.size;
				if (session.size > MAX_AUDIO_BYTES) {
					fail(
						session,
						"Recording is too large. Please record a shorter message.",
					);
					return;
				}
				session.chunks.push(event.data);
			};
			recorder.onerror = () =>
				fail(session, "Couldn't record audio. Please try again or type.");
			recorder.onstop = async () => {
				if (sessionRef.current !== session) return;
				release(session);
				setStatus("transcribing");
				const type = recorder.mimeType;
				const extension = type.startsWith("audio/mp4")
					? "m4a"
					: type.startsWith("audio/ogg")
						? "ogg"
						: "webm";
				const blob = new Blob(session.chunks, { type });
				session.chunks = [];
				if (!blob.size) {
					fail(session, "No audio was recorded. Please try again or type.");
					return;
				}
				try {
					const body = new FormData();
					body.set("audio", blob, `recording.${extension}`);
					const response = await fetch(endpoint, {
						method: "POST",
						body,
						signal: session.controller.signal,
					});
					if (!response.ok) throw new Error("Transcription failed");
					const result: unknown = await response.json();
					if (
						!result ||
						typeof result !== "object" ||
						!("text" in result) ||
						typeof result.text !== "string" ||
						result.text.trim().length > 10_000
					)
						throw new Error("Invalid transcript");
					if (sessionRef.current !== session) return;
					const text = result.text.trim();
					if (text) callbackRef.current(text);
					setNotice(
						(current) =>
							(current ? `${current} ` : "") +
							(text
								? "Transcript ready. Review your message before sending."
								: "No speech was transcribed. Please try again or type."),
					);
					sessionRef.current = null;
					setStatus("idle");
				} catch {
					fail(
						session,
						"Couldn't transcribe the recording. Please record again or type.",
					);
				}
			};
			recorder.start(1000);
			setStatus("recording");
			session.timer = setTimeout(() => {
				if (sessionRef.current !== session) return;
				setNotice("The two-minute recording limit was reached.");
				stopRecording();
			}, 120_000);
		} catch {
			fail(
				session,
				"Could not access or start the microphone. Check permissions, or type instead.",
			);
		}
	}

	return {
		status,
		error,
		notice,
		isRecording: status === "recording",
		isTranscribing: status === "transcribing",
		isBusy: () => sessionRef.current !== null,
		startRecording,
		stopRecording,
		cancelRecording,
	};
}
