import { createFileRoute } from "@tanstack/react-router";
import {
	Loader2,
	Mic,
	MicOff,
	Send,
	Square,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import GuitarRecommendation from "#/components/demo-GuitarRecommendation";
import { useAudioRecorder } from "#/hooks/demo-useAudioRecorder";
import { useTTS } from "#/hooks/demo-useTTS";
import type { ChatMessages } from "#/lib/demo-ai-hook";
import { useGuitarRecommendationChat } from "#/lib/demo-ai-hook";

import "./ai-chat.css";

function InitialLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex-1 flex items-center justify-center px-4">
			<div className="text-center max-w-3xl mx-auto w-full">
				<h1 className="demo-title mb-4">TanStack Chat</h1>
				<p className="demo-muted mb-6 mx-auto max-w-2xl text-lg">
					You can ask me about anything, I might or might not have a good
					answer, but you can still ask.
				</p>
				{children}
			</div>
		</div>
	);
}

function ChattingLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="sticky bottom-0 left-0 right-0 z-10 border-t border-[var(--line)] bg-[var(--header-bg)] backdrop-blur-sm">
			<div className="max-w-3xl mx-auto w-full px-4 py-3">{children}</div>
		</div>
	);
}

function Messages({
	messages,
	playingId,
	onSpeak,
	onStopSpeak,
}: {
	messages: ChatMessages;
	playingId: string | null;
	onSpeak: (text: string, id: string) => void;
	onStopSpeak: () => void;
}) {
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop =
				messagesContainerRef.current.scrollHeight;
		}
	}, [messages]);

	if (!messages.length) {
		return null;
	}

	// Extract text content from message parts
	const getTextContent = (
		parts: ChatMessages[number]["parts"],
	): string | null => {
		for (const part of parts) {
			if (part.type === "text" && part.content) {
				return part.content;
			}
		}
		return null;
	};

	return (
		<div
			ref={messagesContainerRef}
			className="flex-1 overflow-y-auto pb-4 min-h-0"
		>
			<div className="max-w-3xl mx-auto w-full px-4">
				{messages.map((message) => {
					const textContent = getTextContent(message.parts);
					const isPlaying = playingId === message.id;

					return (
						<div
							key={message.id}
							className={`p-4 ${
								message.role === "assistant"
									? "bg-[var(--chip-bg)]"
									: "bg-transparent"
							}`}
						>
							<div className="flex items-start gap-4 max-w-3xl mx-auto w-full">
								{message.role === "assistant" ? (
									<div className="mt-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--lagoon-deep)] text-sm font-medium text-white">
										AI
									</div>
								) : (
									<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--sea-ink-soft)] text-sm font-medium text-white">
										Y
									</div>
								)}
								<div className="flex-1 min-w-0">
									{message.parts.map((part, index) => {
										if (part.type === "text" && part.content) {
											return (
												<div
													className="prose prose-sm min-w-0 max-w-none flex-1"
													key={index}
												>
													<Streamdown>{part.content}</Streamdown>
												</div>
											);
										}
										// Guitar recommendation card
										if (
											part.type === "tool-call" &&
											part.name === "recommendGuitar" &&
											part.output
										) {
											return (
												<div key={part.id} className="max-w-[80%] mx-auto">
													<GuitarRecommendation id={String(part.output?.id)} />
												</div>
											);
										}
										return null;
									})}
								</div>
								{/* TTS button for assistant messages */}
								{message.role === "assistant" && textContent && (
									<button
										onClick={() =>
											isPlaying
												? onStopSpeak()
												: onSpeak(textContent, message.id)
										}
										className="demo-muted flex-shrink-0 p-2 transition-colors hover:text-[var(--lagoon-deep)]"
										title={isPlaying ? "Stop speaking" : "Read aloud"}
									>
										{isPlaying ? (
											<VolumeX className="w-4 h-4" />
										) : (
											<Volume2 className="w-4 h-4" />
										)}
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ChatPage() {
	const [input, setInput] = useState("");

	const recorder = useAudioRecorder({
		onTranscript: (text) =>
			setInput(
				(current) =>
					current + (current && !/\s$/.test(current) ? " " : "") + text,
			),
	});
	const { isRecording, isTranscribing, startRecording, stopRecording } =
		recorder;
	const { playingId, speak, stop: stopTTS } = useTTS();

	const { messages, sendMessage, isLoading, stop } =
		useGuitarRecommendationChat();

	const handleMicClick = () => {
		if (isRecording) {
			stopRecording();
		} else if (!isLoading) {
			void startRecording();
		}
	};

	const Layout = messages.length ? ChattingLayout : InitialLayout;

	return (
		<div className="relative flex h-[calc(100vh-12rem)] min-h-[32rem]">
			<div className="flex-1 flex flex-col min-h-0">
				<Messages
					messages={messages}
					playingId={playingId}
					onSpeak={speak}
					onStopSpeak={stopTTS}
				/>

				<Layout>
					<div className="space-y-3">
						<output className="demo-muted text-sm">
							{recorder.status === "starting"
								? "Waiting for microphone permission…"
								: isRecording
									? "Recording…"
									: isTranscribing
										? "Transcribing…"
										: ""}{" "}
							{recorder.notice}
						</output>
						{recorder.error && (
							<p role="alert" className="demo-alert">
								{recorder.error}
							</p>
						)}
						{isLoading && (
							<div className="flex items-center justify-center">
								<button
									onClick={stop}
									className="demo-button demo-button-danger"
								>
									<Square className="w-4 h-4 fill-current" />
									Stop
								</button>
							</div>
						)}
						<form
							onSubmit={(e) => {
								e.preventDefault();
								if (input.trim() && !recorder.isBusy() && !isLoading) {
									sendMessage(input);
									setInput("");
								}
							}}
						>
							<div className="relative max-w-xl mx-auto flex items-center gap-2">
								<button
									type="button"
									onClick={handleMicClick}
									disabled={
										isLoading ||
										isTranscribing ||
										recorder.status === "starting"
									}
									className={`demo-button p-3 ${
										isRecording ? "demo-button-danger" : "demo-button-secondary"
									} disabled:opacity-50`}
									title={isRecording ? "Stop recording" : "Start recording"}
									aria-label={
										isRecording ? "Stop recording" : "Start recording"
									}
									aria-pressed={isRecording}
								>
									{isTranscribing ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : isRecording ? (
										<MicOff className="w-4 h-4" />
									) : (
										<Mic className="w-4 h-4" />
									)}
								</button>
								{recorder.status !== "idle" && (
									<button
										type="button"
										onClick={recorder.cancelRecording}
										className="demo-button demo-button-secondary"
									>
										Cancel dictation
									</button>
								)}

								<div className="relative flex-1">
									<textarea
										value={input}
										onChange={(e) => setInput(e.target.value)}
										placeholder="Type something clever..."
										className="demo-textarea pr-12 text-sm"
										rows={1}
										style={{ minHeight: "44px", maxHeight: "200px" }}
										disabled={isLoading}
										onInput={(e) => {
											const target = e.target as HTMLTextAreaElement;
											target.style.height = "auto";
											target.style.height =
												Math.min(target.scrollHeight, 200) + "px";
										}}
										onKeyDown={(e) => {
											if (
												e.key === "Enter" &&
												!e.shiftKey &&
												!e.nativeEvent.isComposing &&
												input.trim()
											) {
												e.preventDefault();
												if (recorder.isBusy() || isLoading) return;
												sendMessage(input);
												setInput("");
											}
										}}
									/>
									<button
										type="submit"
										disabled={
											!input.trim() || isLoading || recorder.status !== "idle"
										}
										aria-label="Send message"
										className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[var(--lagoon-deep)] transition-colors hover:text-[var(--sea-ink)] disabled:text-[var(--sea-ink-soft)]"
									>
										<Send className="w-4 h-4" />
									</button>
								</div>
							</div>
						</form>
					</div>
				</Layout>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/demo/ai-chat")({
	component: ChatPage,
});
