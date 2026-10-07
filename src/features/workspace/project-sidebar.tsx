import { useQuery } from "@tanstack/react-query";
import {
	Archive,
	ChevronRight,
	CircleAlert,
	Clock3,
	Folder,
	GitCompareArrows,
	GitMerge,
	GitPullRequest,
	GitPullRequestClosed,
	GitPullRequestDraft,
	PanelLeft,
	Pin,
	Plus,
	ShieldX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type Project, projectDisplayName } from "#/domain/projects";
import { isTurnRunning, type SessionTurnStatus } from "#/domain/session-item";
import {
	CHAT_SEEN_STORAGE_KEY,
	chatsWithPinnedFirst,
	collapsedProjectStorageValue,
	compactRelativeAge,
	newChatIsActive,
	parseCollapsedProjectIds,
	parsePinnedChatIds,
	parseSeenChatKeys,
	pinnedChatStorageValue,
	projectFolderIsExpanded,
	SIDEBAR_COLLAPSED_PROJECTS_KEY,
	SIDEBAR_PINNED_CHATS_KEY,
	type SidebarChat,
	seenChatStorageValue,
	sidebarChatAttention,
	sidebarChatIsRunning,
	sidebarChatSeenKey,
	sidebarChatsEmptyCopy,
	sidebarHasAttentionChat,
	toggleCollapsedProjectIds,
	togglePinnedChatIds,
	withProjectExpanded,
} from "#/domain/sidebar-chats";
import {
	type SidebarChatPrNeed,
	sidebarChatPrNeedLabel,
} from "#/domain/sidebar-pr";
import {
	accountDisplayName,
	accountInitials,
} from "#/domain/workspace-settings";
import { requestJson } from "../projects/api";

interface ProjectSidebarProps {
	projects: Project[];
	projectsLoading: boolean;
	selectedProjectId?: string;
	onSelectProject: (id: string) => void;
	expanded: boolean;
	onToggle: () => void;
	onAddProject: () => void;
	chats: readonly SidebarChat[];
	selectedChatId?: string;
	busyChatIds?: readonly string[];
	openTurnStatus?: SessionTurnStatus;
	openSideTurnStatus?: SessionTurnStatus;
	hasUserMessage?: boolean;
	onSelectChat?: (id: string) => void;
	onNewChat: (projectId?: string) => void;
	onDeleteChat?: (id: string) => void;
	onDeleteProject?: (id: string) => void;
	onOpenSettings?: () => void;
}

export function ProjectSidebar({
	projects,
	projectsLoading,
	selectedProjectId,
	onSelectProject,
	expanded,
	onToggle,
	onAddProject,
	chats,
	selectedChatId,
	busyChatIds = [],
	openTurnStatus,
	openSideTurnStatus,
	hasUserMessage = false,
	onSelectChat,
	onNewChat,
	onDeleteChat,
	onDeleteProject,
	onOpenSettings,
}: ProjectSidebarProps) {
	const sidebarToggle = useRef<HTMLButtonElement>(null);
	const railLogo = useRef<HTMLButtonElement>(null);
	const mobileToggle = useRef<HTMLButtonElement>(null);
	const [hovered, setHovered] = useState(false);
	const [nowMs, setNowMs] = useState(() => Date.now());
	const [seenKeys, setSeenKeys] = useState<readonly string[]>(() =>
		typeof window === "undefined"
			? []
			: parseSeenChatKeys(window.localStorage.getItem(CHAT_SEEN_STORAGE_KEY)),
	);
	const [collapsedProjectIds, setCollapsedProjectIds] = useState<
		readonly string[]
	>(() =>
		typeof window === "undefined"
			? []
			: parseCollapsedProjectIds(
					window.localStorage.getItem(SIDEBAR_COLLAPSED_PROJECTS_KEY),
				),
	);
	const [pinnedChatIds, setPinnedChatIds] = useState<readonly string[]>(() =>
		typeof window === "undefined"
			? []
			: parsePinnedChatIds(
					window.localStorage.getItem(SIDEBAR_PINNED_CHATS_KEY),
				),
	);
	const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const visible = expanded || hovered;
	const selected = projects.find((project) => project.id === selectedProjectId);
	const emptyCopy = sidebarChatsEmptyCopy({
		loading: projectsLoading,
		projectSelected: Boolean(selected),
	});
	const newChatActive = newChatIsActive({
		projectSelected: Boolean(selected),
		hasUserMessage,
	});
	const hasAttentionChat = sidebarHasAttentionChat({
		chats,
		selectedChatId,
		seenKeys,
		busyChatIds,
		openTurnStatus,
		openSideTurnStatus,
	});

	function cancelClose() {
		if (closeTimer.current !== null) clearTimeout(closeTimer.current);
	}

	useEffect(
		() => () => {
			if (closeTimer.current !== null) clearTimeout(closeTimer.current);
		},
		[],
	);

	useEffect(() => {
		const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
		return () => window.clearInterval(timer);
	}, []);

	useEffect(() => {
		const chat = chats.find((row) => row.id === selectedChatId);
		if (!chat) return;
		const turnStatus = openTurnStatus ?? chat.turnStatus;
		if (isTurnRunning(turnStatus ?? "idle")) return;
		const key = sidebarChatSeenKey({ ...chat, turnStatus });
		setSeenKeys((current) => {
			if (current.includes(key)) return current;
			const next = [...current, key];
			window.localStorage.setItem(
				CHAT_SEEN_STORAGE_KEY,
				seenChatStorageValue(next),
			);
			return next;
		});
	}, [selectedChatId, openTurnStatus, chats]);

	function persistCollapsed(next: readonly string[]) {
		setCollapsedProjectIds(next);
		window.localStorage.setItem(
			SIDEBAR_COLLAPSED_PROJECTS_KEY,
			collapsedProjectStorageValue(next),
		);
	}

	function persistPinned(next: readonly string[]) {
		setPinnedChatIds(next);
		window.localStorage.setItem(
			SIDEBAR_PINNED_CHATS_KEY,
			pinnedChatStorageValue(next),
		);
	}

	function openProject(projectId: string) {
		if (projectId !== selectedProjectId) onSelectProject(projectId);
		persistCollapsed(withProjectExpanded(collapsedProjectIds, projectId));
	}

	function toggleProjectFolder(projectId: string) {
		if (projectId !== selectedProjectId) {
			openProject(projectId);
			return;
		}
		persistCollapsed(toggleCollapsedProjectIds(collapsedProjectIds, projectId));
	}

	function toggleProjects() {
		cancelClose();
		setHovered(false);
		onToggle();
		requestAnimationFrame(() => {
			const opener = railLogo.current?.getClientRects().length
				? railLogo
				: mobileToggle;
			(expanded ? opener : sidebarToggle).current?.focus();
		});
	}

	function chatAttention(chat: SidebarChat) {
		const turnStatus =
			chat.id === selectedChatId ? openTurnStatus : chat.turnStatus;
		const running = sidebarChatIsRunning({
			chatId: chat.id,
			turnStatus,
			busyChatIds,
			openChatId: selectedChatId,
			openTurnStatus,
			openSideTurnStatus,
		});
		return sidebarChatAttention({
			running,
			turnStatus,
			selected: chat.id === selectedChatId,
			seen: seenKeys.includes(
				sidebarChatSeenKey({
					...chat,
					turnStatus,
				}),
			),
		});
	}

	return (
		<div
			className="project-sidebar-frame"
			data-peek={!expanded && hovered}
			onPointerEnter={(event) => {
				if (
					event.pointerType !== "mouse" ||
					!window.matchMedia(
						"(hover: hover) and (min-width: 601px) and (min-height: 501px)",
					).matches
				)
					return;
				cancelClose();
				if (!expanded) setHovered(true);
			}}
			onPointerLeave={() => {
				cancelClose();
				closeTimer.current = setTimeout(() => setHovered(false), 140);
			}}
		>
			<button
				ref={mobileToggle}
				type="button"
				className="workspace-sidebar-toggle mobile-projects-toggle"
				aria-label={expanded ? "Close left sidebar" : "Open left sidebar"}
				title={expanded ? "Close left sidebar" : "Open left sidebar"}
				aria-expanded={expanded}
				aria-controls="project-sidebar"
				onClick={toggleProjects}
			>
				<PanelLeft size={18} />
			</button>
			<button
				type="button"
				className="sidebar-backdrop"
				aria-label="Close chats"
				tabIndex={-1}
				onClick={toggleProjects}
			/>
			<aside
				id="project-sidebar"
				className="project-sidebar"
				aria-label="Projects and chats"
				inert={!visible}
				aria-hidden={!visible}
				onKeyDown={(event) => {
					if (event.key === "Escape" && expanded) {
						event.preventDefault();
						toggleProjects();
					}
				}}
			>
				<div className="sidebar-brand-row">
					<a href="/" className="brand" aria-label="Unity home">
						<img
							className="brand-mark"
							src="/brand/unity.svg"
							width={28}
							height={28}
							alt=""
						/>
						<span className="brand-name">Unity</span>
					</a>
					<button
						ref={sidebarToggle}
						type="button"
						className="workspace-sidebar-toggle sidebar-brand-toggle"
						aria-label={expanded ? "Collapse chats" : "Keep chats open"}
						title={expanded ? "Collapse chats" : "Keep chats open"}
						aria-expanded={expanded}
						aria-controls="project-sidebar"
						onClick={toggleProjects}
					>
						<PanelLeft size={18} />
					</button>
				</div>
				<div className="sidebar-toolbar">
					<button
						type="button"
						className="sidebar-new-project"
						onClick={onAddProject}
					>
						<Plus size={16} />
						New project
					</button>
				</div>
				{projects.length ? (
					<ul className="sidebar-projects">
						{projects.map((project) => {
							const selected = project.id === selectedProjectId;
							const open = projectFolderIsExpanded({
								projectId: project.id,
								selectedProjectId,
								collapsedIds: collapsedProjectIds,
							});
							return (
								<li key={project.id} className="sidebar-project">
									<div
										className="sidebar-folder-row"
										data-selected={selected}
										data-open={open}
									>
										<button
											type="button"
											className="sidebar-folder-toggle"
											aria-label={
												open
													? `Collapse ${projectDisplayName(project)}`
													: `Expand ${projectDisplayName(project)}`
											}
											aria-expanded={open}
											onClick={() => toggleProjectFolder(project.id)}
										>
											<ChevronRight size={14} />
										</button>
										<button
											type="button"
											className="sidebar-folder"
											aria-current={selected ? "page" : undefined}
											aria-expanded={open}
											onClick={() =>
												selected
													? toggleProjectFolder(project.id)
													: openProject(project.id)
											}
										>
											<Folder size={16} />
											<span>{projectDisplayName(project)}</span>
										</button>
										<div className="sidebar-folder-actions">
											{onDeleteProject ? (
												<button
													type="button"
													className="sidebar-folder-remove"
													aria-label={`Remove ${projectDisplayName(project)}`}
													title="Remove project"
													onClick={(event) => {
														event.stopPropagation();
														onDeleteProject(project.id);
													}}
												>
													<Archive size={13} strokeWidth={1.5} />
												</button>
											) : null}
											<button
												type="button"
												className="sidebar-folder-add"
												aria-label={`New chat in ${projectDisplayName(project)}`}
												title="New chat"
												data-active={
													selected && newChatActive ? "true" : undefined
												}
												onClick={() => {
													persistCollapsed(
														withProjectExpanded(
															collapsedProjectIds,
															project.id,
														),
													);
													onNewChat(project.id);
												}}
											>
												<Plus size={14} strokeWidth={1.5} />
											</button>
										</div>
									</div>
									{open ? (
										chats.length === 0 ? (
											<p className="sidebar-empty">{emptyCopy}</p>
										) : (
											<ul className="sidebar-chats">
												{chatsWithPinnedFirst(chats, pinnedChatIds).map(
													(chat) => {
														const attention = chatAttention(chat);
														const age = compactRelativeAge(
															chat.updatedAt,
															nowMs,
														);
														const pinned = pinnedChatIds.includes(chat.id);
														return (
															<li
																key={chat.id}
																className="sidebar-chat-row"
																data-selected={chat.id === selectedChatId}
																data-pinned={pinned ? "true" : undefined}
															>
																<button
																	type="button"
																	className="sidebar-chat"
																	data-selected={chat.id === selectedChatId}
																	data-activity={attention}
																	aria-current={
																		chat.id === selectedChatId
																			? "page"
																			: undefined
																	}
																	onClick={() => onSelectChat?.(chat.id)}
																>
																	<span
																		className="sidebar-chat-dot"
																		aria-hidden="true"
																	/>
																	<span className="sidebar-chat-title">
																		{chat.title}
																	</span>
																	{attention === "running" ? (
																		<span className="sr-only">Running</span>
																	) : null}
																	{attention === "attention" ? (
																		<span className="sr-only">
																			Needs attention
																		</span>
																	) : null}
																</button>
																<div className="sidebar-chat-trailing">
																	<button
																		type="button"
																		className="sidebar-chat-pin"
																		aria-label={
																			pinned
																				? `Unpin ${chat.title}`
																				: `Pin ${chat.title}`
																		}
																		aria-pressed={pinned}
																		title={pinned ? "Unpin chat" : "Pin chat"}
																		data-pinned={pinned ? "true" : undefined}
																		onClick={(event) => {
																			event.stopPropagation();
																			persistPinned(
																				togglePinnedChatIds(
																					pinnedChatIds,
																					chat.id,
																				),
																			);
																		}}
																	>
																		<Pin
																			size={13}
																			strokeWidth={1.5}
																			fill={pinned ? "currentColor" : "none"}
																		/>
																	</button>
																	{onDeleteChat ? (
																		<button
																			type="button"
																			className="sidebar-chat-archive"
																			aria-label={`Remove ${chat.title}`}
																			title="Remove chat"
																			onClick={(event) => {
																				event.stopPropagation();
																				onDeleteChat(chat.id);
																			}}
																		>
																			<Archive size={13} strokeWidth={1.5} />
																		</button>
																	) : null}
																	{chat.prNeed ? (
																		<a
																			className="sidebar-chat-pr"
																			href={chat.prUrl ?? undefined}
																			target={chat.prUrl ? "_blank" : undefined}
																			rel={
																				chat.prUrl ? "noreferrer" : undefined
																			}
																			data-need={chat.prNeed}
																			aria-label={`${sidebarChatPrNeedLabel(chat.prNeed)} for ${chat.title}`}
																			title={sidebarChatPrNeedLabel(
																				chat.prNeed,
																			)}
																			onClick={(event) =>
																				event.stopPropagation()
																			}
																		>
																			<SidebarChatPrIcon need={chat.prNeed} />
																		</a>
																	) : null}
																	{age ? (
																		<span className="sidebar-chat-age">
																			{age}
																		</span>
																	) : null}
																</div>
															</li>
														);
													},
												)}
											</ul>
										)
									) : null}
								</li>
							);
						})}
					</ul>
				) : projectsLoading ? null : (
					<p className="sidebar-empty">No repositories connected.</p>
				)}
				{onOpenSettings ? (
					<SidebarAccountButton onOpen={onOpenSettings} />
				) : null}
			</aside>
			<nav
				className="sidebar-rail"
				aria-label="Chat shortcuts"
				inert={visible}
				aria-hidden={visible}
			>
				<button
					type="button"
					className="rail-brand"
					ref={railLogo}
					aria-label="Open chats"
					title="Open chats"
					aria-expanded={expanded}
					aria-controls="project-sidebar"
					data-activity={hasAttentionChat ? "attention" : undefined}
					onClick={toggleProjects}
				>
					<img
						className="brand-mark"
						src="/brand/unity.svg"
						width={28}
						height={28}
						alt=""
					/>
					{hasAttentionChat ? (
						<span className="sr-only">A chat needs attention</span>
					) : null}
				</button>
				<button
					type="button"
					className="panel-toggle"
					aria-label="New chat"
					title="New chat"
					data-active={newChatActive}
					onClick={() => onNewChat()}
				>
					<Plus size={16} />
				</button>
			</nav>
		</div>
	);
}

function SidebarAccountButton({ onOpen }: { onOpen: () => void }) {
	const account = useQuery({
		queryKey: ["account"],
		queryFn: () =>
			requestJson<{
				user: {
					name?: string | null;
					email?: string | null;
					image?: string | null;
				};
			}>("/api/account"),
	});
	const user = account.data?.user ?? {};
	const name = accountDisplayName(user);
	return (
		<button
			type="button"
			className="sidebar-account"
			aria-label={`Settings for ${name}`}
			title="Settings"
			onClick={onOpen}
		>
			{user.image ? (
				<img src={user.image} width={28} height={28} alt="" />
			) : (
				<span className="sidebar-account-initials" aria-hidden="true">
					{accountInitials(user)}
				</span>
			)}
			<span className="sidebar-account-copy">
				<span className="sidebar-account-name">{name}</span>
				<span className="sidebar-account-meta">Settings</span>
			</span>
		</button>
	);
}

function SidebarChatPrIcon({ need }: { need: SidebarChatPrNeed }) {
	if (need === "ready") return <GitPullRequest size={13} strokeWidth={1.5} />;
	if (need === "merged") return <GitMerge size={13} strokeWidth={1.5} />;
	if (need === "pending") return <Clock3 size={13} strokeWidth={1.5} />;
	if (need === "conflict")
		return <GitCompareArrows size={13} strokeWidth={1.5} />;
	if (need === "blocked") return <ShieldX size={13} strokeWidth={1.5} />;
	if (need === "checks_failed")
		return <CircleAlert size={13} strokeWidth={1.5} />;
	if (need === "draft")
		return <GitPullRequestDraft size={13} strokeWidth={1.5} />;
	return <GitPullRequestClosed size={13} strokeWidth={1.5} />;
}
