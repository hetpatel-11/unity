import { workspacePublicationBranch } from "./publication";

export type SidebarChatPrNeed =
	| "ready"
	| "merged"
	| "pending"
	| "conflict"
	| "blocked"
	| "checks_failed"
	| "draft"
	| "closed";

export type ListedPullRequest = {
	readonly number: number;
	readonly url: string;
	readonly head: string;
	readonly draft: boolean;
	readonly state: string;
	readonly merged: boolean;
	readonly mergeable: boolean | null;
	readonly mergeableState: string | null;
};

export type SidebarChatPrMark = {
	readonly need: SidebarChatPrNeed;
	readonly url: string;
	readonly label: string;
};

export function sidebarChatPrNeedFromPullRequest(pr: {
	readonly draft: boolean;
	readonly state: string;
	readonly merged: boolean;
	readonly mergeable: boolean | null;
	readonly mergeableState: string | null;
}): SidebarChatPrNeed {
	if (pr.merged) return "merged";
	if (pr.state === "closed") return "closed";
	const mergeableState = pr.mergeableState?.trim().toLowerCase() ?? "";
	if (pr.mergeable === false || mergeableState === "dirty") return "conflict";
	if (mergeableState === "blocked" || mergeableState === "behind") {
		return "blocked";
	}
	if (mergeableState === "unstable") return "checks_failed";
	if (pr.draft || mergeableState === "draft") return "draft";
	if (
		pr.state === "open" &&
		pr.mergeable === true &&
		mergeableState === "clean"
	)
		return "ready";
	return "pending";
}

export function sidebarChatPrNeedLabel(need: SidebarChatPrNeed) {
	if (need === "ready") return "Ready to merge";
	if (need === "merged") return "Pull request merged";
	if (need === "pending") return "Merge readiness not confirmed";
	if (need === "conflict") return "Has merge conflicts";
	if (need === "blocked") return "Cannot be merged";
	if (need === "checks_failed") return "Checks failed";
	if (need === "draft") return "Draft pull request";
	return "Pull request closed";
}

export function sidebarChatPrMarkForWorkspace(input: {
	readonly workspaceId?: string | null;
	readonly workingBranch?: string | null;
	readonly pullRequests: readonly ListedPullRequest[];
}): SidebarChatPrMark | null {
	const workspaceId = input.workspaceId?.trim();
	const head =
		input.workingBranch?.trim() ||
		(workspaceId ? workspacePublicationBranch(workspaceId) : null);
	if (!head) return null;
	const pullRequest = input.pullRequests.find(
		(row) => row.head === head || row.head.endsWith(`:${head}`),
	);
	if (!pullRequest) return null;
	const need = sidebarChatPrNeedFromPullRequest(pullRequest);
	return {
		need,
		url: pullRequest.url,
		label: sidebarChatPrNeedLabel(need),
	};
}
