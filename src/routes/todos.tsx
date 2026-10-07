import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	ExtractionRequestSchema,
	ExtractionResultSchema,
	SavedTodosSchema,
	TaskTitleSchema,
	TODO_STORAGE_KEY,
	type Todo,
} from "#/lib/todo";

type Message = {
	id: string;
	role: "user" | "assistant";
	text: string;
	retryMessage?: string;
};

export const Route = createFileRoute("/todos")({
	head: () => ({ meta: [{ title: "Todos | TanStack Start" }] }),
	component: TodoPage,
});

function TodoPage() {
	const [todos, setTodos] = useState<Todo[]>([]);
	const [title, setTitle] = useState("");
	const [input, setInput] = useState("");
	const [messages, setMessages] = useState<Message[]>([]);
	const [ready, setReady] = useState(false);
	const [pending, setPending] = useState(false);
	const [storageWarning, setStorageWarning] = useState("");
	const changed = useRef(false);
	const active = useRef(false);
	const inFlight = useRef<AbortController | null>(null);
	const chatBox = useRef<HTMLDivElement>(null);

	useEffect(() => {
		active.current = true;
		try {
			const saved = localStorage.getItem(TODO_STORAGE_KEY);
			if (saved !== null) setTodos(SavedTodosSchema.parse(JSON.parse(saved)));
		} catch {
			setStorageWarning(
				"Couldn't restore saved tasks. You can still use this list.",
			);
		}
		setReady(true);
		return () => {
			active.current = false;
			inFlight.current?.abort();
		};
	}, []);

	useEffect(() => {
		if (!changed.current) return;
		try {
			// ponytail: one browser tab owns each save; add tab sync if concurrent editing is needed.
			localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));
			setStorageWarning("");
		} catch {
			setStorageWarning(
				"Tasks are available here, but couldn't be saved for your next visit.",
			);
		}
	}, [todos]);

	useEffect(() => {
		if (messages.length && chatBox.current) {
			chatBox.current.scrollTop = chatBox.current.scrollHeight;
		}
	}, [messages]);

	function addTasks(titles: string[]) {
		const added = titles.map((taskTitle) => ({
			id: crypto.randomUUID(),
			title: taskTitle,
			completed: false,
		}));
		changed.current = true;
		setTodos((current) => [...current, ...added]);
	}

	async function extract(message: string, retryId?: string) {
		const parsed = ExtractionRequestSchema.safeParse({ message });
		if (!parsed.success || inFlight.current || !ready) return;
		const controller = new AbortController();
		inFlight.current = controller;
		setPending(true);
		if (retryId) {
			setMessages((current) =>
				current.map((entry) =>
					entry.id === retryId ? { ...entry, retryMessage: undefined } : entry,
				),
			);
		} else {
			setMessages((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					role: "user",
					text: parsed.data.message,
				},
			]);
			setInput("");
		}
		let errorText =
			"Couldn't extract tasks. Check your connection and retry, or add tasks manually.";
		try {
			const response = await fetch("/api/tasks/extract", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(parsed.data),
				signal: controller.signal,
			});
			if (!response.ok) {
				if (response.status === 503) {
					errorText =
						"Chat extraction is unavailable. You can still add tasks manually.";
				}
				throw new Error("Extraction failed");
			}
			const result = ExtractionResultSchema.safeParse(await response.json());
			if (!result.success) {
				errorText =
					"The response wasn't a valid task list. Please retry or add tasks manually.";
				throw new Error("Invalid result");
			}
			if (controller.signal.aborted || !active.current) return;
			const { tasks } = result.data;
			if (tasks.length) addTasks(tasks);
			setMessages((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					text: tasks.length
						? `Added ${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}:\n${tasks.map((task) => `• ${task}`).join("\n")}`
						: "No new tasks found. This chat extracts new tasks; use the list checkboxes to mark existing tasks complete.",
				},
			]);
		} catch {
			if (controller.signal.aborted || !active.current) return;
			setMessages((current) => [
				...current,
				{
					id: crypto.randomUUID(),
					role: "assistant",
					text: errorText,
					retryMessage: parsed.data.message,
				},
			]);
		} finally {
			if (inFlight.current === controller) inFlight.current = null;
			if (active.current) setPending(false);
		}
	}

	const manualValid = TaskTitleSchema.safeParse(title).success;
	const chatValid = ExtractionRequestSchema.safeParse({
		message: input,
	}).success;
	const completed = todos.filter((todo) => todo.completed).length;

	return (
		<main className="demo-page">
			<div className="mb-8">
				<p className="island-kicker mb-3">A little less to remember</p>
				<h1 className="demo-title">Your todo list</h1>
				<p className="demo-muted mt-3">
					Add one task, or turn a brain dump into a list.
				</p>
			</div>
			{storageWarning && (
				<output className="demo-alert mb-5 block">{storageWarning}</output>
			)}
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
				<section aria-labelledby="tasks-heading" className="demo-panel min-w-0">
					<div className="mb-6 flex flex-wrap items-center justify-between gap-2">
						<h2 id="tasks-heading" className="text-xl font-bold">
							Tasks
						</h2>
						<span className="demo-pill">
							{completed} of {todos.length} complete
						</span>
					</div>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							const task = TaskTitleSchema.safeParse(title);
							if (!task.success || !ready) return;
							addTasks([task.data]);
							setTitle("");
						}}
					>
						<label
							htmlFor="task-title"
							className="mb-2 block text-sm font-semibold"
						>
							New task
						</label>
						<div className="flex gap-2">
							<input
								id="task-title"
								className="demo-input min-w-0"
								placeholder="What needs doing?"
								value={title}
								disabled={!ready}
								onChange={(event) => setTitle(event.target.value)}
								aria-describedby="task-title-help"
								aria-invalid={title.trim().length > 500}
							/>
							<button
								type="submit"
								className="demo-button shrink-0"
								disabled={!ready || !manualValid}
							>
								Add
							</button>
						</div>
						<p id="task-title-help" className="demo-muted mt-2 text-xs">
							{title.trim().length > 500
								? "Keep the task title to 500 characters or fewer."
								: "Add a task directly. No chat needed."}
						</p>
					</form>
					{todos.length ? (
						<ul className="mt-6 space-y-3" aria-label="Todo list">
							{todos.map((todo) => (
								<li key={todo.id} className="demo-list-item">
									<label className="flex cursor-pointer items-start gap-3">
										<input
											type="checkbox"
											checked={todo.completed}
											className="mt-1 h-4 w-4 shrink-0 accent-[var(--lagoon-deep)]"
											onChange={() => {
												changed.current = true;
												setTodos((current) =>
													current.map((entry) =>
														entry.id === todo.id
															? { ...entry, completed: !entry.completed }
															: entry,
													),
												);
											}}
										/>
										<span
											className={`min-w-0 break-words ${todo.completed ? "demo-muted line-through" : ""}`}
										>
											{todo.title}
										</span>
									</label>
								</li>
							))}
						</ul>
					) : (
						<p className="demo-muted py-12 text-center">
							{ready
								? "Your list is clear. Add a task above or use the chat."
								: "Loading your saved tasks…"}
						</p>
					)}
					<p className="demo-muted mt-6 text-xs">
						{storageWarning
							? "Your list is available for this visit."
							: "Saved in this browser."}
					</p>
				</section>

				<section aria-labelledby="chat-heading" className="demo-panel min-w-0">
					<h2 id="chat-heading" className="text-xl font-bold">
						Brain dump
					</h2>
					<p className="demo-muted mt-2 text-sm">
						Tell me what you need to do. I'll pull out the tasks.
					</p>
					<div
						ref={chatBox}
						role="log"
						aria-label="Task extraction conversation"
						aria-live="polite"
						className="my-6 max-h-96 min-h-40 space-y-4 overflow-y-auto"
					>
						{messages.length ? (
							messages.map((message) => (
								<div
									key={message.id}
									className={`rounded-xl p-4 ${message.role === "user" ? "bg-[var(--chip-bg)]" : "border border-[var(--line)]"}`}
								>
									<p className="demo-muted mb-2 text-xs font-semibold">
										{message.role === "user" ? "You" : "Assistant"}
									</p>
									<p
										className="whitespace-pre-wrap break-words text-sm"
										role={message.retryMessage ? "alert" : undefined}
									>
										{message.text}
									</p>
									{message.retryMessage && (
										<button
											type="button"
											className="demo-button demo-button-secondary mt-3"
											disabled={pending}
											onClick={() =>
												void extract(message.retryMessage ?? "", message.id)
											}
										>
											Retry
										</button>
									)}
								</div>
							))
						) : (
							<p className="demo-muted rounded-xl bg-[var(--chip-bg)] p-4 text-sm">
								Try "Buy milk, finish the slides, and call Mum." Tasks will be
								added automatically.
							</p>
						)}
					</div>
					{pending && (
						<output className="demo-muted mb-3 block text-sm">
							Finding your tasks…
						</output>
					)}
					<form
						onSubmit={(event) => {
							event.preventDefault();
							void extract(input);
						}}
					>
						<label
							htmlFor="task-message"
							className="mb-2 block text-sm font-semibold"
						>
							Things to do
						</label>
						<textarea
							id="task-message"
							className="demo-textarea"
							placeholder="Dump your tasks here…"
							rows={4}
							value={input}
							onChange={(event) => setInput(event.target.value)}
							disabled={!ready || pending}
							aria-describedby="task-message-help"
							aria-invalid={input.length > 10_000}
							onKeyDown={(event) => {
								if (
									event.key === "Enter" &&
									!event.shiftKey &&
									!event.nativeEvent.isComposing
								) {
									event.preventDefault();
									void extract(input);
								}
							}}
						/>
						<p id="task-message-help" className="demo-muted my-2 text-xs">
							{input.length > 10_000
								? "Keep the message to 10,000 characters or fewer."
								: "Enter to send. Shift + Enter for a new line."}
						</p>
						<button
							type="submit"
							className="demo-button"
							disabled={!ready || pending || !chatValid}
						>
							{pending ? "Extracting…" : "Extract tasks"}
						</button>
					</form>
					<p className="demo-muted mt-4 text-xs">
						Chat adds new tasks. Mark them complete in the list.
					</p>
				</section>
			</div>
		</main>
	);
}
