import {
	isWorkspaceAtCapacity,
	isWorkspaceComputeAllowanceExhausted,
} from "./failure-message";

export const workspaceStatuses = [
	"queued",
	"provisioning",
	"cloning",
	"installing",
	"ready",
	"failed",
] as const;
export type WorkspaceStatus = (typeof workspaceStatuses)[number];

export interface ProjectWorkspace {
	id: string;
	userId: string;
	projectId: string;
	status: WorkspaceStatus;
	providerRef: string | null;
	templateSnapshotId: string | null;
	templateSourceRef?: string | null;
	templateSourceSha?: string | null;
	errorMessage: string | null;
	updatedAt: string;
}

export function workspaceSlug(workspaceId: string) {
	return `ytimesy-ws-${workspaceId}`;
}

export function canStartPrepare(status: WorkspaceStatus | undefined) {
	return status === undefined || status === "queued" || status === "failed";
}

export function workspacePrepareShowsStatus(
	status: WorkspaceStatus | undefined,
) {
	return status === "failed";
}

export type WorkspaceEnvironmentState = Pick<
	ProjectWorkspace,
	"status" | "providerRef"
> & {
	templateSnapshotId?: string | null;
	errorMessage?: string | null;
};

export function workspaceSessionMachineRef(
	workspace: Pick<ProjectWorkspace, "status" | "providerRef"> | null,
) {
	if (workspace?.status === "ready" && workspace.providerRef)
		return workspace.providerRef;
	return null;
}

/**
 * Agents copy from the sealed snapshot. The unused template VM is optional
 * once that snapshot exists; pausing or deleting it must not block Connect.
 */
export function workspaceEnvironmentIsReady(
	workspace: WorkspaceEnvironmentState | null,
) {
	if (workspace?.status !== "ready") return false;
	return Boolean(workspace.providerRef || workspace.templateSnapshotId);
}

export function harnessConnectBlockedReason(
	workspace: WorkspaceEnvironmentState | null,
	harnessName: string,
	kind: "sign_in" | "connect" = "sign_in",
) {
	const action =
		kind === "connect"
			? `connecting ${harnessName}`
			: `signing in to ${harnessName}`;
	if (workspaceEnvironmentIsReady(workspace)) return null;
	if (!workspace) return `Prepare a workspace before ${action}.`;
	if (workspace.status === "failed")
		return (
			workspace.errorMessage ??
			`Workspace preparation failed. Retry, then finish ${action}.`
		);
	return `Wait for workspace preparation to finish before ${action}.`;
}

export function codexConnectBlockedReason(
	workspace: WorkspaceEnvironmentState | null,
) {
	return harnessConnectBlockedReason(workspace, "Codex");
}

export function branchSwitchBlockedReason(
	status: WorkspaceStatus | undefined,
): string | null {
	if (
		status === "provisioning" ||
		status === "cloning" ||
		status === "installing"
	)
		return "Wait for workspace preparation to finish.";
	return null;
}

export function blocksDuplicateProvision(status: WorkspaceStatus) {
	return (
		status === "ready" ||
		status === "provisioning" ||
		status === "cloning" ||
		status === "installing"
	);
}

export function needsMachineCreate(
	status: WorkspaceStatus,
	providerRef: string | null,
) {
	return status === "provisioning" && providerRef === null;
}

export function needsMachineRecover(
	status: WorkspaceStatus,
	providerRef: string | null,
) {
	return (
		providerRef !== null &&
		(status === "provisioning" ||
			status === "cloning" ||
			status === "installing")
	);
}

export function publicFailureMessage(error: unknown) {
	const message =
		error instanceof Error
			? error.message
			: error instanceof Response
				? error.statusText
				: "Workspace preparation failed. Retry after checking GitHub access.";
	return redactInfrastructure(
		workspaceCapacityMessage(redactSecrets(message)),
	).slice(0, 300);
}

export function workspaceCapacityMessage(message: string) {
	if (isWorkspaceAtCapacity(message)) {
		return "This workspace plan is at its limit. Delete an unused agent session or raise the quota before starting another. Pausing does not free a slot.";
	}
	if (isWorkspaceComputeAllowanceExhausted(message)) {
		return "This workspace plan has used its compute allowance. Wait for the allowance to reset or upgrade the plan, then try again.";
	}
	return message;
}

export function redactInfrastructure(value: string) {
	return value
		.replace(/https?:\/\/[a-z0-9.-]+\.style\.dev\S*/gi, "workspace")
		.replace(/[a-z0-9.-]+\.style\.dev/gi, "workspace")
		.replace(/\bfreestyle-vm\b/gi, "ytimesy")
		.replace(/\bFreestyle\b/g, "workspace")
		.replace(/\bfreestyle\b/gi, "workspace")
		.replace(/\bnoVNC\b/g, "desktop")
		.replace(/\bnovnc\b/gi, "desktop")
		.replace(/\bx11vnc\b/gi, "desktop")
		.replace(/\bwebsockify\b/gi, "desktop")
		.replace(/\bvnc\.html\b/gi, "desktop")
		.replace(/\bvcpu_time\b/gi, "compute")
		.replace(/\bmemory_time\b/gi, "memory");
}

export function redactSecrets(value: string) {
	return value
		.replace(/ghp_[A-Za-z0-9]+/g, "[redacted]")
		.replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
		.replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
		.replace(
			/AUTHORIZATION:\s*bearer\s+\S+/gi,
			"AUTHORIZATION: bearer [redacted]",
		)
		.replace(
			/AUTHORIZATION:\s*basic\s+\S+/gi,
			"AUTHORIZATION: basic [redacted]",
		)
		.replace(/x-access-token:[^@\s]+@/g, "x-access-token:***@");
}
