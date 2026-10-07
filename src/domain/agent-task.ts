import type { AgentProviderId } from "./agent-provider";
import type { SessionTurnStatus } from "./session-item";

export const MAX_AGENT_TASK_DEPTH = 3;

export type AgentTaskStatus =
	| "draft"
	| "working"
	| "waiting"
	| "idle"
	| "done"
	| "failed";

export function shouldPollAgentTasks(
	leadStatus: SessionTurnStatus,
	tasks: readonly Pick<AgentTask, "status">[],
): boolean {
	return (
		leadStatus === "running" ||
		tasks.some((task) => task.status === "working" || task.status === "waiting")
	);
}
export type AgentTaskPlacement = "shared" | "fresh";
export type AgentTaskAccess = "read_only" | "read_write";
export type AgentTaskExecution = "parallel" | "stacked";
export type AgentTaskReviewState = "pending" | "reviewed" | "rejected";

/** Cloud read-only tasks expose inspection tools, not arbitrary shell execution. Native adapters enforce their own command sandbox. */
export function taskExecutionCapabilities(task: {
	readonly harness: AgentProviderId;
	readonly parentSessionId: string | null;
	readonly taskAccess: string | null;
}) {
	const cloud = task.harness === "codex" || task.harness === "api";
	const writable = !!task.parentSessionId && task.taskAccess === "read_write";
	return { commandExecution: !cloud || writable, workspaceEdits: writable };
}

export type AgentTaskPlan = {
	readonly prompt: string;
	readonly placement: AgentTaskPlacement;
	readonly access: AgentTaskAccess;
	readonly execution: AgentTaskExecution;
	readonly dependsOnSessionId: string | null;
};

export type AgentTask = {
	readonly id: string;
	readonly parentSessionId: string;
	readonly title: string;
	readonly label: string;
	readonly depth: number;
	readonly status: AgentTaskStatus;
	readonly prompt: string;
	readonly placement: AgentTaskPlacement;
	readonly access: AgentTaskAccess;
	readonly execution: AgentTaskExecution;
	readonly dependsOnSessionId: string | null;
	readonly summary: string | null;
	readonly reviewState: AgentTaskReviewState;
	readonly branch: string | null;
	readonly pullRequestUrl: string | null;
	readonly harnessId: AgentProviderId;
	readonly listedModelId: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
};

export function agentTaskStatusReceipt(
	task: AgentTask,
	includePrompts = false,
) {
	if (includePrompts) return task;
	const { prompt: _assignment, ...status } = task;
	return status;
}

export function agentTaskSummaryPage(
	summary: string | null,
	start: unknown = 0,
) {
	if (
		typeof start !== "number" ||
		!Number.isSafeInteger(start) ||
		start < 0 ||
		start > 32_000_000
	)
		throw new Error("Summary start must be a non-negative safe integer.");
	const characters = Array.from(summary ?? "");
	return {
		content: characters.slice(start, start + 4000).join(""),
		start,
		nextStart: start + 4000 < characters.length ? start + 4000 : null,
	};
}

type TaskSession = {
	readonly id: string;
	readonly parentSessionId: string | null;
	readonly title: string;
	readonly turnStatus: SessionTurnStatus;
	readonly harness: AgentProviderId;
	readonly listedModelId: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly taskPrompt?: string | null;
	readonly taskState?: AgentTaskStatus | null;
	readonly taskPlacement?: AgentTaskPlacement | null;
	readonly taskAccess?: AgentTaskAccess | null;
	readonly taskExecution?: AgentTaskExecution | null;
	readonly dependsOnSessionId?: string | null;
	readonly taskSummary?: string | null;
	readonly taskReviewState?: AgentTaskReviewState | null;
	readonly taskBranch?: string | null;
	readonly taskPullRequestUrl?: string | null;
};

export function taskStatusFromTurn(
	turnStatus: SessionTurnStatus,
	storedStatus?: AgentTaskStatus | null,
): AgentTaskStatus {
	if (turnStatus === "running") return "working";
	if (storedStatus) return storedStatus;
	if (turnStatus === "completed") return "done";
	if (turnStatus === "failed") return "failed";
	return "idle";
}

/**
 * Task labels are positional inside their parent, matching the hierarchy the
 * user sees: Task 1, Task 1.1, Task 1.2, and so on.
 */
export function agentTaskTree(
	rootSessionId: string,
	sessions: readonly TaskSession[],
): readonly AgentTask[] {
	const children = new Map<string, TaskSession[]>();
	for (const session of sessions) {
		if (!session.parentSessionId) continue;
		const siblings = children.get(session.parentSessionId) ?? [];
		siblings.push(session);
		children.set(session.parentSessionId, siblings);
	}
	for (const siblings of children.values()) {
		siblings.sort((left, right) =>
			left.createdAt.localeCompare(right.createdAt),
		);
	}

	const tasks: AgentTask[] = [];
	function append(parentId: string, prefix: string, depth: number) {
		for (const [index, session] of (children.get(parentId) ?? []).entries()) {
			const position = prefix ? `${prefix}.${index + 1}` : `${index + 1}`;
			tasks.push({
				id: session.id,
				parentSessionId: parentId,
				title: session.title,
				label: `Task ${position}`,
				depth,
				status: taskStatusFromTurn(session.turnStatus, session.taskState),
				prompt: session.taskPrompt ?? "",
				placement: session.taskPlacement ?? "fresh",
				access: session.taskAccess ?? "read_write",
				execution: session.taskExecution ?? "parallel",
				dependsOnSessionId: session.dependsOnSessionId ?? null,
				summary: session.taskSummary ?? null,
				reviewState: session.taskReviewState ?? "pending",
				branch: session.taskBranch ?? null,
				pullRequestUrl: session.taskPullRequestUrl ?? null,
				harnessId: session.harness,
				listedModelId: session.listedModelId,
				createdAt: session.createdAt,
				updatedAt: session.updatedAt,
			});
			append(session.id, position, depth + 1);
		}
	}
	append(rootSessionId, "", 1);
	return tasks;
}

export function canSpawnAgentTask(parentDepth: number) {
	return parentDepth < MAX_AGENT_TASK_DEPTH;
}

export function validateAgentTaskPlan(plan: AgentTaskPlan): string | null {
	if (!plan.prompt.trim()) return "A task prompt is required.";
	if (plan.placement === "shared" && plan.access !== "read_only") {
		return "Shared-machine tasks must be read-only.";
	}
	if (plan.execution === "stacked" && !plan.dependsOnSessionId) {
		return "Stacked tasks require a predecessor.";
	}
	if (plan.execution === "parallel" && plan.dependsOnSessionId) {
		return "Parallel tasks cannot declare a predecessor.";
	}
	return null;
}

export function agentTaskStartBlockedByDependency(
	task: Pick<AgentTask, "execution" | "dependsOnSessionId">,
	predecessor: Pick<AgentTask, "status" | "reviewState" | "branch"> | null,
): string | null {
	if (task.execution !== "stacked") return null;
	if (!task.dependsOnSessionId || !predecessor) {
		return "The stacked task predecessor is unavailable.";
	}
	if (predecessor.status !== "done") {
		return "The stacked task must wait for its predecessor to finish.";
	}
	if (predecessor.reviewState !== "reviewed") {
		return "Review the predecessor before starting stacked work.";
	}
	if (!predecessor.branch) {
		return "Publish the predecessor before starting stacked work.";
	}
	return null;
}
