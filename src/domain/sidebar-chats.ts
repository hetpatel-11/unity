import type { AgentProviderId } from "./agent-provider";
import { claudeSessionRemembersSignIn } from "./claude-auth";
import { isTurnRunning, type SessionTurnStatus } from "./session-item";
import type { SidebarChatPrNeed } from "./sidebar-pr";

export type SidebarChat = {
	readonly id: string;
	readonly title: string;
	readonly turnStatus?: SessionTurnStatus;
	readonly listedModelId?: string | null;
	readonly harnessId?: AgentProviderId | null;
	readonly updatedAt?: string | null;
	readonly workspaceId?: string | null;
	readonly workingBranch?: string | null;
	readonly prUrl?: string | null;
	readonly prNeed?: SidebarChatPrNeed | null;
};

export type SidebarChatAttention = "running" | "attention" | "idle";

export const CHAT_SEEN_STORAGE_KEY = "ytimesy-chat-seen";

export function compactRelativeAge(
	from: string | null | undefined,
	nowMs = Date.now(),
) {
	if (!from) return null;
	const then = Date.parse(from);
	if (!Number.isFinite(then)) return null;
	const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
	if (seconds < 45) return "now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks}w`;
	return `${Math.floor(days / 30)}mo`;
}

export function sidebarChatSeenKey(input: {
	readonly id: string;
	readonly turnStatus?: SessionTurnStatus;
	readonly updatedAt?: string | null;
}) {
	return `${input.id}:${input.turnStatus ?? "idle"}:${input.updatedAt ?? ""}`;
}

export function parseSeenChatKeys(raw: string | null): readonly string[] {
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((key): key is string => typeof key === "string");
	} catch {
		return [];
	}
}

export function seenChatStorageValue(keys: readonly string[]) {
	return JSON.stringify([...new Set(keys)]);
}

export function sidebarChatAttention(input: {
	readonly running: boolean;
	readonly turnStatus?: SessionTurnStatus;
	readonly selected: boolean;
	readonly seen: boolean;
}): SidebarChatAttention {
	if (input.running) return "running";
	if (input.selected || input.seen) return "idle";
	if (input.turnStatus === "completed" || input.turnStatus === "failed") {
		return "attention";
	}
	return "idle";
}

export function sidebarHasAttentionChat(input: {
	readonly chats: readonly SidebarChat[];
	readonly selectedChatId?: string;
	readonly seenKeys: readonly string[];
	readonly busyChatIds?: readonly string[];
	readonly openTurnStatus?: SessionTurnStatus;
	readonly openSideTurnStatus?: SessionTurnStatus;
}): boolean {
	const seen = new Set(input.seenKeys);
	return input.chats.some((chat) => {
		const running = sidebarChatIsRunning({
			chatId: chat.id,
			turnStatus: chat.turnStatus,
			busyChatIds: input.busyChatIds ?? [],
			openChatId: input.selectedChatId,
			openTurnStatus: input.openTurnStatus,
			openSideTurnStatus: input.openSideTurnStatus,
		});
		return (
			sidebarChatAttention({
				running,
				turnStatus: chat.turnStatus,
				selected: chat.id === input.selectedChatId,
				seen: seen.has(sidebarChatSeenKey(chat)),
			}) === "attention"
		);
	});
}

export function chatsListedInSidebar(input: {
	projectSelected: boolean;
	hasUserMessage: boolean;
	title: string;
}): readonly SidebarChat[] {
	if (!input.projectSelected || !input.hasUserMessage) return [];
	return [{ id: "current", title: input.title }];
}

export function sidebarChatsEmptyCopy(input: {
	loading: boolean;
	projectSelected: boolean;
}): string | null {
	if (input.loading) return "Loading chats…";
	if (!input.projectSelected) return "Pick a repository to start a chat.";
	return "No chats yet.";
}

export function newChatIsActive(input: {
	projectSelected: boolean;
	hasUserMessage: boolean;
}): boolean {
	return input.projectSelected && !input.hasUserMessage;
}

export const SIDEBAR_PINNED_STORAGE_KEY = "ytimesy-sidebar-pinned";
export const SIDEBAR_PINNED_CHATS_KEY = "ytimesy-pinned-chats";
export const SIDEBAR_COLLAPSED_PROJECTS_KEY =
	"ytimesy-sidebar-collapsed-projects";

export function parseCollapsedProjectIds(
	raw: string | null,
): readonly string[] {
	return parseSeenChatKeys(raw);
}

export function collapsedProjectStorageValue(ids: readonly string[]) {
	return seenChatStorageValue(ids);
}

export function projectFolderIsExpanded(input: {
	readonly projectId: string;
	readonly selectedProjectId?: string;
	readonly collapsedIds: readonly string[];
}): boolean {
	if (input.projectId !== input.selectedProjectId) return false;
	return !input.collapsedIds.includes(input.projectId);
}

export function toggleCollapsedProjectIds(
	collapsedIds: readonly string[],
	projectId: string,
): string[] {
	return collapsedIds.includes(projectId)
		? collapsedIds.filter((id) => id !== projectId)
		: [...collapsedIds, projectId];
}

export function withProjectExpanded(
	collapsedIds: readonly string[],
	projectId: string,
): string[] {
	return collapsedIds.filter((id) => id !== projectId);
}

export function sidebarIsPinnedInStorage(value: string | null): boolean {
	return value === "1";
}

export function sidebarPinnedStorageValue(pinned: boolean): "1" | "0" {
	return pinned ? "1" : "0";
}

export function parsePinnedChatIds(raw: string | null): readonly string[] {
	return parseSeenChatKeys(raw);
}

export function pinnedChatStorageValue(ids: readonly string[]) {
	return seenChatStorageValue(ids);
}

export function togglePinnedChatIds(
	pinnedIds: readonly string[],
	chatId: string,
): string[] {
	return pinnedIds.includes(chatId)
		? pinnedIds.filter((id) => id !== chatId)
		: [...pinnedIds, chatId];
}

export function chatsWithPinnedFirst(
	chats: readonly SidebarChat[],
	pinnedIds: readonly string[],
): SidebarChat[] {
	const pinned = new Set(pinnedIds);
	return [
		...chats.filter((chat) => pinned.has(chat.id)),
		...chats.filter((chat) => !pinned.has(chat.id)),
	];
}

export function selectedChatIdAfterDelete(input: {
	readonly chats: readonly { readonly id: string }[];
	readonly selectedChatId: string | undefined;
	readonly deletedChatId: string;
}): string | undefined {
	if (input.selectedChatId !== input.deletedChatId) {
		return input.selectedChatId;
	}
	return input.chats.find((chat) => chat.id !== input.deletedChatId)?.id;
}

export function withBusyChat(
	ids: readonly string[],
	chatId: string | undefined,
): string[] {
	if (!chatId || ids.includes(chatId)) return [...ids];
	return [...ids, chatId];
}

export function withoutBusyChat(
	ids: readonly string[],
	chatId: string | undefined,
): string[] {
	if (!chatId) return [...ids];
	return ids.filter((id) => id !== chatId);
}

export function composerBusyForOpenChat(input: {
	readonly openChatId: string | undefined;
	readonly busyChatIds: readonly string[];
}): boolean {
	return Boolean(
		input.openChatId && input.busyChatIds.includes(input.openChatId),
	);
}

export function sidebarChatIsRunning(input: {
	readonly chatId: string;
	readonly turnStatus?: SessionTurnStatus;
	readonly busyChatIds: readonly string[];
	readonly openChatId?: string;
	readonly openTurnStatus?: SessionTurnStatus;
	readonly openSideTurnStatus?: SessionTurnStatus;
}): boolean {
	if (input.busyChatIds.includes(input.chatId)) return true;
	if (input.chatId === input.openChatId) {
		return (
			input.openTurnStatus === "running" ||
			input.openSideTurnStatus === "running"
		);
	}
	return input.turnStatus === "running";
}

export function sidebarHasRunningChat(input: {
	readonly chats: readonly SidebarChat[];
	readonly busyChatIds: readonly string[];
	readonly openChatId?: string;
	readonly openTurnStatus?: SessionTurnStatus;
	readonly openSideTurnStatus?: SessionTurnStatus;
}): boolean {
	return input.chats.some((chat) =>
		sidebarChatIsRunning({
			chatId: chat.id,
			turnStatus: chat.turnStatus,
			busyChatIds: input.busyChatIds,
			openChatId: input.openChatId,
			openTurnStatus: input.openTurnStatus,
			openSideTurnStatus: input.openSideTurnStatus,
		}),
	);
}

export function withChatTurnStatus(
	chats: readonly SidebarChat[],
	chatId: string | undefined,
	turnStatus: SessionTurnStatus,
): SidebarChat[] {
	if (!chatId) return [...chats];
	return chats.map((chat) =>
		chat.id === chatId ? { ...chat, turnStatus } : chat,
	);
}

export function listedChatTurnStatus(
	chats: readonly SidebarChat[],
	chatId: string,
): SessionTurnStatus {
	return chats.find((chat) => chat.id === chatId)?.turnStatus ?? "idle";
}

export function listedChatModelId(
	chats: readonly SidebarChat[],
	chatId: string,
): string {
	return chats.find((chat) => chat.id === chatId)?.listedModelId?.trim() ?? "";
}

/**
 * Claude sign-in is per user, not per chat. A new composer can reuse the
 * model id from any earlier Claude chat so Send is not blocked by Sign in.
 */
export function rememberedClaudeModelIdFromChats(
	chats: readonly SidebarChat[],
): string {
	const claudeFirst = chats.find(
		(chat) =>
			chat.harnessId === "claude" &&
			claudeSessionRemembersSignIn(chat.listedModelId),
	);
	if (claudeFirst?.listedModelId) return claudeFirst.listedModelId.trim();
	const any = chats.find((chat) =>
		claudeSessionRemembersSignIn(chat.listedModelId),
	);
	return any?.listedModelId?.trim() ?? "";
}

export function listedChatHarnessId(
	chats: readonly SidebarChat[],
	chatId: string,
	fallback: AgentProviderId,
): AgentProviderId {
	return chats.find((chat) => chat.id === chatId)?.harnessId ?? fallback;
}

export function composerHarnessForChat(input: {
	readonly listedHarnessId?: AgentProviderId | null;
	readonly connectionProvider?: AgentProviderId | null;
	readonly fallback: AgentProviderId;
}): AgentProviderId {
	return input.listedHarnessId ?? input.connectionProvider ?? input.fallback;
}

/**
 * A running sibling keeps polling after the user switches chats. Skip the
 * open row (its own interval handles that) and any chat whose Send is still
 * in flight so the submit and the poll do not share a guest.
 */
export function backgroundTurnPollChatIds(input: {
	readonly chats: readonly SidebarChat[];
	readonly openChatId?: string;
	readonly busyChatIds: readonly string[];
}): string[] {
	return input.chats
		.filter((chat) => {
			if (chat.id === input.openChatId) return false;
			if (input.busyChatIds.includes(chat.id)) return false;
			return isTurnRunning(chat.turnStatus ?? "idle");
		})
		.map((chat) => chat.id);
}

export function sessionViewAppliesToOpenChat(input: {
	readonly openChatId?: string;
	readonly agentSessionId: string | null;
}): boolean {
	return Boolean(
		input.agentSessionId && input.agentSessionId === input.openChatId,
	);
}
