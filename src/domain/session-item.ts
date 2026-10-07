import type { AgentTodo } from "./agent-todos";
import type { ApiTokenUsage } from "./api-token-usage";
import type { CodexUsage } from "./codex-usage";
import { SessionItemId } from "./ids";
import { visibleRuntimeUserText } from "./runtime-handoff";
import {
	fileChangesFromShellCommand,
	remainingShellCommandAfterWrites,
} from "./shell-file-change";

export type SessionTurnStatus = "idle" | "running" | "completed" | "failed";

export type ToolActivityStatus =
	| "inProgress"
	| "completed"
	| "failed"
	| "declined";

export type UserMessageItem = {
	readonly contextUsage?: Pick<CodexUsage, "context" | "compacting">;
	readonly apiUsage?: ApiTokenUsage;
	readonly kind: "userMessage";
	readonly id: SessionItemId;
	readonly text: string;
	readonly timing?: {
		readonly startedAt: number;
		readonly completedAt?: number;
	};
};

export type AgentMessageItem = {
	readonly kind: "agentMessage";
	readonly id: SessionItemId;
	readonly text: string;
	readonly streaming?: boolean;
	readonly phase?: "commentary" | "final_answer";
};

export type ReasoningItem = {
	readonly kind: "reasoning";
	readonly id: SessionItemId;
	readonly summaries: readonly string[];
	readonly durationSeconds?: number;
};

export type PlanItem = {
	readonly kind: "plan";
	readonly id: SessionItemId;
	readonly text: string;
	readonly todos?: readonly AgentTodo[];
};

export type CommandExecutionItem = {
	readonly kind: "commandExecution";
	readonly id: SessionItemId;
	readonly command: string;
	readonly cwd: string | null;
	readonly status: ToolActivityStatus;
	readonly output: string | null;
	readonly exitCode: number | null;
};

export type FileChangeEntry = {
	readonly path: string;
	readonly change: "add" | "delete" | "update";
	readonly additions: number;
	readonly deletions: number;
	readonly preview: string | null;
};

export type FileChangeItem = {
	readonly kind: "fileChange";
	readonly id: SessionItemId;
	readonly status: ToolActivityStatus;
	readonly changes: readonly FileChangeEntry[];
};

export type McpToolCallItem = {
	readonly kind: "mcpToolCall";
	readonly id: SessionItemId;
	readonly server: string;
	readonly tool: string;
	readonly status: Exclude<ToolActivityStatus, "declined">;
};

export type DynamicToolCallItem = {
	readonly kind: "dynamicToolCall";
	readonly id: SessionItemId;
	readonly tool: string;
	readonly input?: string;
	readonly output?: string;
	readonly status: Exclude<ToolActivityStatus, "declined">;
};

export type WebSearchItem = {
	readonly kind: "webSearch";
	readonly id: SessionItemId;
	readonly query: string | null;
};

export type ErrorSessionItem = {
	readonly kind: "error";
	readonly id: SessionItemId;
	readonly message: string;
};

export type UnknownSessionItem = {
	readonly kind: "unknown";
	readonly id: SessionItemId;
	readonly type: string;
};

export type SessionItem =
	| UserMessageItem
	| AgentMessageItem
	| ReasoningItem
	| PlanItem
	| CommandExecutionItem
	| FileChangeItem
	| McpToolCallItem
	| DynamicToolCallItem
	| WebSearchItem
	| ErrorSessionItem
	| UnknownSessionItem;

export function isConversationItem(
	item: SessionItem,
): item is UserMessageItem | AgentMessageItem {
	return item.kind === "userMessage" || item.kind === "agentMessage";
}

export function sessionRecordHasConversation(items: unknown): boolean {
	if (!Array.isArray(items)) return false;
	return items.some((item) => {
		if (!item || typeof item !== "object" || !("kind" in item)) return false;
		return item.kind === "userMessage" || item.kind === "agentMessage";
	});
}

export function isTurnRunning(status: SessionTurnStatus): boolean {
	return status === "running";
}

export function liveActivityStatus(
	item: SessionItem,
): ToolActivityStatus | null {
	if (
		item.kind === "commandExecution" ||
		item.kind === "fileChange" ||
		item.kind === "mcpToolCall" ||
		item.kind === "dynamicToolCall"
	) {
		return item.status;
	}
	if (item.kind === "reasoning" && item.durationSeconds == null) {
		return "inProgress";
	}
	return null;
}

export function fileChangesFromSessionItems(
	items: readonly SessionItem[],
): readonly FileChangeEntry[] {
	const latestByPath = new Map<string, FileChangeEntry>();
	for (const item of items) {
		if (item.kind !== "commandExecution") continue;
		for (const change of fileChangesFromShellCommand(item.command)) {
			latestByPath.set(change.path, change);
		}
	}
	for (const item of items) {
		if (item.kind !== "fileChange") continue;
		for (const change of item.changes) {
			latestByPath.set(change.path, change);
		}
	}
	return [...latestByPath.values()];
}

export function lastUserMessageText(
	items: readonly SessionItem[],
): string | null {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];
		if (
			item?.kind === "userMessage" &&
			item.text.trim() &&
			!isWorkspacePreamble(item.text)
		) {
			return item.text;
		}
	}
	return null;
}

export function lastAgentMessageText(
	items: readonly SessionItem[],
): string | null {
	for (let index = items.length - 1; index >= 0; index -= 1) {
		const item = items[index];
		if (item?.kind === "agentMessage" && item.text.trim()) return item.text;
	}
	return null;
}

export function reasoningSummariesFromTurn(
	items: readonly SessionItem[],
): string[] {
	let start = 0;
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (
			item?.kind === "userMessage" &&
			item.text.trim() &&
			!isWorkspacePreamble(item.text)
		) {
			start = index + 1;
		}
	}
	const summaries: string[] = [];
	for (const item of items.slice(start)) {
		if (item.kind !== "reasoning") continue;
		for (const summary of item.summaries) {
			const trimmed = summary.trim();
			if (trimmed) summaries.push(trimmed);
		}
	}
	return summaries;
}

export function sessionItemsFromUnknown(value: unknown): SessionItem[] {
	return Array.isArray(value)
		? normalizeRuntimeUserMessages(value as SessionItem[])
		: [];
}

function normalizeRuntimeUserMessages(
	items: readonly SessionItem[],
): SessionItem[] {
	return items.map((item) =>
		item.kind === "userMessage"
			? { ...item, text: visibleRuntimeUserText(item.text) }
			: item,
	);
}

export function sessionItemsQueuedWithUser(
	items: readonly SessionItem[],
	text: string,
	messageId?: string,
): SessionItem[] {
	const queued = text.trim();
	if (!queued) return [...items];
	if (lastUserMessageText(items) === queued) return [...items];
	return [
		...items,
		{
			kind: "userMessage",
			id: SessionItemId(
				messageId ?? `queued-user-${items.length}-${queued.length}`,
			),
			text: queued,
			timing: { startedAt: Date.now() },
		},
	];
}

export function sessionViewItems(
	live: readonly SessionItem[],
	recorded: readonly SessionItem[],
): SessionItem[] {
	const normalizedRecorded = normalizeRuntimeUserMessages(recorded);
	const merged = mergeSessionViewItems(
		normalizeRuntimeUserMessages(live),
		normalizedRecorded,
	);
	const recordedUsers = normalizedRecorded.filter(
		(item) => item.kind === "userMessage",
	);
	let ordinal = 0;
	let matchingPrefix = true;
	return merged.map((item) => {
		if (item.kind !== "userMessage") return item;
		const previous = recordedUsers[ordinal++];
		matchingPrefix = matchingPrefix && previous?.text === item.text;
		return matchingPrefix && previous?.timing
			? { ...item, timing: previous.timing }
			: item;
	});
}

function mergeSessionViewItems(
	live: readonly SessionItem[],
	recorded: readonly SessionItem[],
): SessionItem[] {
	const ahead = transcriptAheadOfPeer(live, recorded);
	if (ahead) {
		const tree = (ahead === recorded ? live : recorded).filter(
			(item) => item.kind === "fileChange",
		);
		const withoutTree = ahead.filter((item) => item.kind !== "fileChange");
		return tree.length === 0 ? [...ahead] : [...withoutTree, ...tree];
	}
	if (sessionRecordHasConversation(live)) return [...live];
	if (!sessionRecordHasConversation(recorded)) return [...live];
	const tree = live.filter((item) => item.kind === "fileChange");
	const withoutTree = recorded.filter((item) => item.kind !== "fileChange");
	return tree.length === 0 ? [...recorded] : [...withoutTree, ...tree];
}

function transcriptAheadOfPeer(
	left: readonly SessionItem[],
	right: readonly SessionItem[],
): SessionItem[] | null {
	const leftUser = lastUserMessageText(left);
	const rightUser = lastUserMessageText(right);
	if (!leftUser || !rightUser || leftUser === rightUser) return null;
	const leftHasRight = userTextsFromItems(left).includes(rightUser);
	const rightHasLeft = userTextsFromItems(right).includes(leftUser);
	if (leftHasRight && !rightHasLeft) return [...left];
	if (rightHasLeft && !leftHasRight) return [...right];
	return null;
}

function userTextsFromItems(items: readonly SessionItem[]): string[] {
	return items
		.filter((item) => item.kind === "userMessage")
		.map((item) => item.text);
}

export function sessionViewShouldReplaceOpenTurn(input: {
	readonly currentStatus: SessionTurnStatus;
	readonly nextStatus: SessionTurnStatus;
	readonly currentItems: readonly SessionItem[];
	readonly nextItems: readonly SessionItem[];
}): boolean {
	if (input.currentStatus !== "running") return true;
	if (input.nextStatus === "running") return true;
	const currentUser = lastUserMessageText(input.currentItems);
	const nextUser = lastUserMessageText(input.nextItems);
	if (currentUser && currentUser !== nextUser) return false;
	if (input.nextStatus === "idle") return false;
	if (
		(input.nextStatus === "completed" || input.nextStatus === "failed") &&
		currentUser &&
		!turnSettledAfterUser(input.nextItems, currentUser)
	) {
		return false;
	}
	return input.nextStatus === "completed" || input.nextStatus === "failed";
}

function turnSettledAfterUser(
	items: readonly SessionItem[],
	user: string,
): boolean {
	let lastUser = -1;
	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item?.kind === "userMessage" && item.text === user) lastUser = index;
	}
	if (lastUser < 0) return false;
	return items
		.slice(lastUser + 1)
		.some((item) => item.kind === "agentMessage" || item.kind === "error");
}

export function sessionUsesFollowUpLayout(input: {
	readonly items: readonly SessionItem[];
	readonly turnStatus: SessionTurnStatus;
	readonly listedTitle?: string;
}): boolean {
	return (
		Boolean(lastUserMessageText(input.items)) ||
		input.turnStatus === "running" ||
		Boolean(input.listedTitle && input.listedTitle !== "New session")
	);
}

export function sessionTitleFromItems(items: readonly SessionItem[]): string {
	const text = lastUserMessageText(items);
	if (!text) return "New session";
	const line = text.trim().split("\n")[0]?.trim() ?? "";
	if (!line) return "New session";
	return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

export function visibleSessionItems(
	serverItems: readonly SessionItem[],
	optimisticItems: readonly SessionItem[],
): SessionItem[] {
	if (optimisticItems.length === 0) return [...serverItems];
	return [
		...serverItems,
		...optimisticItems.filter(
			(item) =>
				item.kind !== "userMessage" ||
				!serverItems.some(
					(existing) =>
						existing.kind === "userMessage" && existing.text === item.text,
				),
		),
	];
}

export function compactTimelineItems(
	items: readonly SessionItem[],
): SessionItem[] {
	const presented: SessionItem[] = [];
	for (const item of normalizeRuntimeUserMessages(items)) {
		if (item.kind === "userMessage" && isWorkspacePreamble(item.text)) {
			continue;
		}
		if (item.kind === "commandExecution") {
			presented.push(...presentCommandExecution(item));
			continue;
		}
		presented.push(item);
	}
	return presented;
}

function isWorkspacePreamble(text: string): boolean {
	return text.startsWith("You are in a ytimesy workspace VM.");
}

export function sessionTurnLooksSettled(
	items: readonly SessionItem[],
): boolean {
	if (items.some((item) => liveActivityStatus(item) === "inProgress")) {
		return false;
	}
	const last = compactTimelineItems(items).at(-1);
	return last?.kind === "agentMessage" || last?.kind === "error";
}

export function persistableTurnStatusFromTranscript(input: {
	readonly liveStatus: SessionTurnStatus;
	readonly items: readonly SessionItem[];
}): SessionTurnStatus {
	if (input.liveStatus !== "running" || !sessionTurnLooksSettled(input.items)) {
		return input.liveStatus;
	}
	const last = compactTimelineItems(input.items).at(-1);
	return last?.kind === "error" ? "failed" : "completed";
}

export function showTurnWorking(
	items: readonly SessionItem[],
	turnStatus: SessionTurnStatus,
): boolean {
	if (turnStatus !== "running") return false;
	const last = compactTimelineItems(items).at(-1);
	if (last == null || last.kind === "userMessage") return true;
	if (last.kind === "agentMessage" || last.kind === "error") return false;
	if (last.kind === "reasoning") return false;
	if (last.kind === "commandExecution" && last.status === "inProgress") {
		return false;
	}
	if (last.kind === "fileChange" && last.status === "inProgress") {
		return false;
	}
	if (last.kind === "dynamicToolCall" && last.status === "inProgress") {
		return false;
	}
	if (last.kind === "mcpToolCall" && last.status === "inProgress") {
		return false;
	}
	return true;
}

function presentCommandExecution(item: CommandExecutionItem): SessionItem[] {
	const writes = fileChangesFromShellCommand(item.command);
	if (writes.length === 0) return [item];
	const remainder = remainingShellCommandAfterWrites(item.command, writes);
	const files: FileChangeItem = {
		kind: "fileChange",
		id: remainder ? SessionItemId(`${item.id}:files`) : item.id,
		status: item.status,
		changes: writes,
	};
	if (!remainder) return [files];
	return [files, { ...item, command: remainder }];
}
