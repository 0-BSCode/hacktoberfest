import { z } from "zod";

export const TaskTitleSchema = z.string().trim().min(1).max(500);

export const ExtractionRequestSchema = z.object({
	message: z.string().max(10_000).trim().min(1),
});

export const ExtractionResultSchema = z.object({
	tasks: z.array(TaskTitleSchema).max(50),
});

export const SavedTodosSchema = z
	.array(
		z.object({
			id: z.uuid(),
			title: TaskTitleSchema,
			completed: z.boolean(),
		}),
	)
	.refine(
		(todos) => new Set(todos.map((todo) => todo.id)).size === todos.length,
	);

export type Todo = z.infer<typeof SavedTodosSchema>[number];

export const TODO_STORAGE_KEY = "hacktoberfest.todos.v1";
