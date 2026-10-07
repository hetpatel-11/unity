import type { AgentTask } from "./agent-task";
import type { SessionItem, SessionTurnStatus } from "./session-item";

export type AgentTaskActivity = AgentTask & {
	readonly items: readonly SessionItem[];
	readonly turnStatus: SessionTurnStatus;
};

const INTERNAL_EVENT_PREFIX = "\u2063ytimesy-child-event:";
export function childTaskEventQueueText(eventId: string) {
	return `${INTERNAL_EVENT_PREFIX}${eventId}`;
}

export function isInternalChildTaskMessage(text: string): boolean {
	return (
		text.startsWith(INTERNAL_EVENT_PREFIX) ||
		((/^[^\n]+ (finished|failed)\. Its final summary is below:\n\n/.test(
			text,
		) ||
			/^[^\n]+ is blocked and needs your decision:\n\n/.test(text)) &&
			(text.endsWith(
				"Inspect its evidence and diff before accepting or publishing the result.",
			) ||
				text.endsWith(
					"Answer the child, escalate to the user if necessary, or revise the plan.",
				)))
	);
}

/** Old notification turns remain in storage, but are not user-authored chat. */
export function childTaskPublicItems(
	items: readonly SessionItem[],
): SessionItem[] {
	return items.filter(
		(item) =>
			(item.kind !== "userMessage" && item.kind !== "agentMessage") ||
			!isInternalChildTaskMessage(item.text),
	);
}

export function childTaskPromptId(
	task: Pick<AgentTask, "createdAt"> & { readonly id?: string },
	items: readonly SessionItem[],
) {
	let promptId: SessionItem["id"] | undefined;
	for (const item of items) {
		if (item.kind === "userMessage") promptId = item.id;
		if (isTaskCreation(item, task.id)) return promptId;
	}
	const prompts = items.filter((item) => item.kind === "userMessage");
	const createdAt = Date.parse(task.createdAt);
	return prompts
		.filter((item) => item.timing && item.timing.startedAt <= createdAt)
		.at(-1)?.id;
}

/** Prefer durable delegation evidence; old prompts may not carry timestamps. */
export function childTaskAnchorId(
	task: Pick<AgentTask, "id" | "createdAt">,
	items: readonly SessionItem[],
) {
	const creation = items.find((item) => isTaskCreation(item, task.id));
	if (creation) return creation.id;
	const promptId = childTaskPromptId(task, items);
	const promptIndex = items.findIndex((item) => item.id === promptId);
	if (promptIndex < 0) return undefined;
	const nextPrompt = items.findIndex(
		(item, index) => index > promptIndex && item.kind === "userMessage",
	);
	const turn = items.slice(
		promptIndex + 1,
		nextPrompt < 0 ? undefined : nextPrompt,
	);
	return (
		turn
			.filter(
				(item) =>
					item.kind === "dynamicToolCall" && isTaskCreationTool(item.tool),
			)
			.at(-1)?.id ?? promptId
	);
}

function isTaskCreationTool(name: string) {
	return name.endsWith("create_task") || name.endsWith("launch_ready_tasks");
}

function isTaskCreation(item: SessionItem, taskId?: string) {
	if (
		!taskId ||
		item.kind !== "dynamicToolCall" ||
		!isTaskCreationTool(item.tool) ||
		!item.output
	)
		return false;
	return containsTaskId(item.output, taskId, 0);
}

function containsTaskId(
	value: unknown,
	taskId: string,
	depth: number,
): boolean {
	if (depth > 5) return false;
	if (typeof value === "string") {
		try {
			return containsTaskId(JSON.parse(value), taskId, depth + 1);
		} catch {
			return false;
		}
	}
	if (!value || typeof value !== "object") return false;
	if ("taskId" in value && value.taskId === taskId) return true;
	return Object.values(value).some((nested) =>
		containsTaskId(nested, taskId, depth + 1),
	);
}
