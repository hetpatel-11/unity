import {
	type WorkspaceEnvironmentState,
	workspaceEnvironmentIsReady,
} from "./project-workspace";

export type BranchComparison = {
	head: string;
	base: string;
	aheadBy: number;
};

export type PublicationAuthor = {
	readonly name: string;
	readonly email: string;
};

export function publicationBlockedReason(
	comparison: BranchComparison,
): string | null {
	if (comparison.head === comparison.base)
		return "Choose a branch with commits that are not already on the base branch.";
	if (comparison.aheadBy < 1)
		return "Nothing to publish. The branch has no commits ahead of the base.";
	return null;
}

export function publicationWorkspaceBlockedReason(
	workspace: WorkspaceEnvironmentState | null,
) {
	if (workspaceEnvironmentIsReady(workspace)) return null;
	if (!workspace) return "Prepare a workspace before publishing.";
	if (workspace.status === "failed")
		return (
			workspace.errorMessage ??
			"Workspace preparation failed. Retry, then publish."
		);
	return "Wait for workspace preparation to finish before publishing.";
}

export function publicationSessionBlockedReason(
	sessionProviderRef: string | null,
) {
	if (sessionProviderRef) return null;
	return "Connect an agent before publishing.";
}

export function publicationCommitAuthor(user: {
	readonly name?: string | null;
	readonly email?: string | null;
}): PublicationAuthor {
	return (
		publicationHumanAuthor(user) ?? {
			name: "noreply",
			email: "noreply@ytimesy.com",
		}
	);
}

export function publicationHumanAuthor(user: {
	readonly name?: string | null;
	readonly email?: string | null;
}): PublicationAuthor | null {
	const email = user.email?.trim();
	if (!email) return null;
	const name = user.name?.trim() || email.split("@")[0] || "ytimesy";
	return { name, email };
}

export function commitCoAuthorTrailer(author: PublicationAuthor) {
	return `Co-authored-by: ${author.name} <${author.email}>`;
}

export function publicationCoAuthor(input: {
	readonly author: PublicationAuthor;
	readonly bot: PublicationAuthor | null;
}) {
	if (!input.bot || input.bot.email === input.author.email) return null;
	return input.bot;
}

export function workspacePublicationBranch(workspaceId: string) {
	const compact = workspaceId.replaceAll("-", "").slice(0, 12).toLowerCase();
	return `ytimesy-${compact || "workspace"}`;
}

export function publicationHeadBranch(input: {
	readonly selectedBranch: string;
	readonly defaultBranch: string;
	readonly workspaceId: string;
}) {
	if (input.selectedBranch === input.defaultBranch)
		return workspacePublicationBranch(input.workspaceId);
	return input.selectedBranch;
}
