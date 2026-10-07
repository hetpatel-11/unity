import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "#/demo/client-action";
import { ArrowUp, Square, X } from "lucide-react";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { MatrixDotLoader } from "#/components/ui/matrix-dot-loader";
import {
	type AgentCompetition,
	competitionModeAvailable,
	competitionSendIsEnabled,
} from "#/domain/agent-competition";
import { connectedProviderId } from "#/domain/agent-connection";
import {
	type AgentProviderId,
	agentProviderById,
} from "#/domain/agent-provider";
import { recordedContextUsage } from "#/domain/api-progress";
import type { AgentTaskActivity } from "#/domain/child-task-activity";
import {
	claudeSessionRemembersSignIn,
	rememberedClaudeModels,
} from "#/domain/claude-auth";
import {
	canResumeDisconnectedFollowUp,
	composerCanStartSignIn,
	composerSendIsEnabled,
	harnessLoginShouldShow,
	harnessRequiresAccountLogin,
	selectedHarnessIsConnected,
} from "#/domain/harness-access";
import { SessionItemId } from "#/domain/ids";
import {
	composerModelIdForCatalog,
	listedModelDisplayName,
} from "#/domain/listed-model";
import { expandModelRuns, type ModelRun } from "#/domain/parallel-models";
import type { Project } from "#/domain/projects";
import {
	lastUserMessageText,
	type SessionItem,
	sessionUsesFollowUpLayout,
	visibleSessionItems,
} from "#/domain/session-item";
import {
	composerSlashCommands,
	matchingSlashCommands,
	parseSlashDraft,
	type SlashCommand,
} from "#/domain/slash-command";
import { captureAnalytics } from "#/features/analytics/client";
import { authClient } from "#/features/auth/client";
import type { PublicCodexSession } from "#/domain/session-view";
import {
	getConversationRecoveryPoints,
	restoreConversationPoint,
} from "#/demo/session-actions";
import { ContextUsage } from "./context-usage";
import { ConversationRecovery } from "./conversation-recovery";
import { HarnessLogin } from "./harness-login";
import {
	composerListedModels,
	resolveReasoningLevel,
	sessionModelsFromListed,
} from "./model-capabilities";
import { getAgentModelCatalog } from "#/demo/catalog-actions";
import { ProjectContext } from "./project-context";
import { SessionControls } from "./session-controls";
import { SessionTimeline } from "./session-timeline";
import { SlashCommandPalette } from "./slash-command-palette";
import { TaskInput } from "./task-input";

export type InspectorView = "files" | "diff" | "terminal" | "desktop";

export function SessionLauncher({
	session,
	busy,
	harnessId,
	onHarnessIdChange,
	onSend,
	onConnect,
	onStop,
	onOpenInspector,
	onOpenFile,
	onOpenCandidate,
	onRecovered,
	initialDraft = "",
	competitions = [],
	childTasks = [],
	allowComparison = true,
	projects,
	selectedProject,
	onSelectProject,
	listedTitle,
	projectPickerOpen,
	onProjectPickerOpenChange,
}: {
	session: PublicCodexSession;
	busy: boolean;
	harnessId: AgentProviderId;
	onHarnessIdChange: (id: AgentProviderId) => void;
	onSend: (
		text: string,
		modelId: string,
		options?: {
			readonly reasoningId?: string;
			readonly fast?: boolean;
			readonly leaderCount?: number;
			readonly attemptModelIds?: readonly string[];
			readonly userMessageId?: string;
		},
	) => void;
	onConnect: () => void;
	onStop: () => void;
	onOpenInspector: (view: InspectorView) => void;
	onOpenFile?: (path: string) => void;
	onOpenCandidate?: (sessionId: string) => void;
	onRecovered?: (sessionId: string, prompt: string | null) => Promise<void>;
	initialDraft?: string;
	competitions?: readonly AgentCompetition[];
	childTasks?: readonly AgentTaskActivity[];
	allowComparison?: boolean;
	projects: Project[];
	selectedProject?: Project;
	onSelectProject: (id: string) => void;
	listedTitle?: string;
	projectPickerOpen?: boolean;
	onProjectPickerOpenChange?: (open: boolean) => void;
}) {
	const harnessReady =
		selectedHarnessIsConnected(session.connection, harnessId) ||
		(harnessId === "claude" &&
			claudeSessionRemembersSignIn(session.listedModelId));
	const canResumeFollowUp = canResumeDisconnectedFollowUp({
		harnessId,
		connection: session.connection,
		turnStatus: session.turnStatus,
		snapshotAvailable: session.snapshotAvailable,
		listedModelId: session.listedModelId,
	});
	const composerReady = (harnessReady && session.canSend) || canResumeFollowUp;
	const listedCatalog =
		session.models.length > 0
			? session.models
			: harnessId === "claude" && session.listedModelId
				? rememberedClaudeModels(session.listedModelId)
				: session.listedModelId
					? [
							{
								id: session.listedModelId,
								label:
									listedModelDisplayName(session.listedModelId) ||
									session.listedModelId,
							},
						]
					: [];
	const loadCatalog = useServerFn(getAgentModelCatalog);
	const identity = authClient.useSession();
	const queryClient = useQueryClient();
	useEffect(() => {
		if (
			!identity.data?.user.id ||
			connectedProviderId(session.connection) !== harnessId ||
			session.models.length === 0
		)
			return;
		queryClient.setQueryData(
			["agent-model-catalog", identity.data.user.id, harnessId],
			session.models,
		);
	}, [
		identity.data?.user.id,
		harnessId,
		session.connection,
		session.models,
		queryClient,
	]);
	const catalog = useQuery({
		queryKey: ["agent-model-catalog", identity.data?.user.id, harnessId],
		enabled: Boolean(identity.data?.user.id),
		queryFn: () => loadCatalog({ data: { provider: harnessId } }),
		staleTime: 60_000,
	});
	const models = useMemo(
		() =>
			sessionModelsFromListed(
				composerListedModels({
					sessionModels: session.models,
					catalogModels: catalog.data ?? [],
					rememberedModels: listedCatalog,
					sessionConnected:
						connectedProviderId(session.connection) === harnessId,
				}),
			),
		[
			session.models,
			session.connection,
			harnessId,
			listedCatalog,
			catalog.data,
		],
	);
	const [attachments, setAttachments] = useState<File[]>([]);
	const loadRecovery = useServerFn(getConversationRecoveryPoints);
	const recoverPoint = useServerFn(restoreConversationPoint);
	const recoveryPoints = useQuery({
		queryKey: [
			"conversation-recovery",
			selectedProject?.id,
			session.agentSessionId,
			session.items.length,
			session.turnStatus,
		],
		enabled:
			!!selectedProject?.id &&
			!!session.agentSessionId &&
			(harnessId === "codex" || harnessId === "api"),
		queryFn: () => {
			if (!selectedProject || !session.agentSessionId) return [];
			return loadRecovery({
				data: {
					projectId: selectedProject.id,
					sessionId: session.agentSessionId,
				},
			});
		},
	});
	const [draft, setDraft] = useState(initialDraft);
	const [modelId, setModelId] = useState(session.listedModelId);
	const [reasoningId, setReasoningId] = useState("");
	const [fast, setFast] = useState(false);
	const [multipleModels, setMultipleModels] = useState(false);
	const [modelRuns, setModelRuns] = useState<ModelRun[]>([]);
	const attemptModelIds = expandModelRuns(modelRuns);
	const leaderCount = multipleModels ? attemptModelIds.length : 1;
	const [lastModelByHarness, setLastModelByHarness] = useState<
		Partial<Record<AgentProviderId, string>>
	>(() =>
		session.listedModelId ? { [harnessId]: session.listedModelId } : {},
	);
	const selectedModel = models.find((model) => model.id === modelId);
	const [optimisticItems, setOptimisticItems] = useState<SessionItem[]>([]);
	const [slashIndex, setSlashIndex] = useState(0);
	const items = visibleSessionItems(session.items, optimisticItems);
	const turnStatus = session.turnStatus;
	const activeCompetition = competitions.find((group) =>
		["queued", "working", "judging"].includes(group.status),
	);
	const lastUserText = lastUserMessageText(items);
	const followUpLayout = sessionUsesFollowUpLayout({
		items,
		turnStatus,
		listedTitle,
	});
	const competitionMode =
		competitionModeAvailable({
			harnessId,
		}) && allowComparison;
	const canSendCompetition = (text: string) =>
		competitionSendIsEnabled({
			modeAvailable: competitionMode,
			selected: leaderCount > 1,
			busy,
			turnRunning: turnStatus === "running",
			hasSession: Boolean(session.agentSessionId),
			hasCodexAuth: session.snapshotAvailable,
			harnessId,
			text,
			modelId,
		});
	function composerCanSend(text: string, slashCommand: boolean) {
		if (activeCompetition) return false;
		if (competitionMode && leaderCount > 1) return canSendCompetition(text);
		return composerSendIsEnabled({
			harnessId,
			connection: session.connection,
			turnStatus,
			snapshotAvailable: session.snapshotAvailable,
			listedModelId: session.listedModelId,
			canSend: session.canSend,
			busy,
			draft: text,
			modelId,
			slashDraft: slashCommand,
		});
	}
	const slashDraft = parseSlashDraft(draft);
	const slashCommands = useMemo(
		() =>
			composerSlashCommands({
				authenticated: harnessReady,
				requiresAccountLogin: harnessRequiresAccountLogin(harnessId),
				turnRunning: turnStatus === "running",
				canSend: composerReady,
				hasLastUserMessage: Boolean(lastUserText),
				hasModels: models.length > 0,
			}),
		[
			composerReady,
			harnessId,
			lastUserText,
			models.length,
			harnessReady,
			turnStatus,
		],
	);
	const visibleSlashCommands = slashDraft
		? matchingSlashCommands(slashDraft, slashCommands)
		: [];

	useEffect(() => {
		if (!draft.startsWith("/")) {
			setSlashIndex(0);
			return;
		}
		setSlashIndex(0);
	}, [draft]);

	useEffect(() => {
		const connectedHarness = connectedProviderId(session.connection);
		const lastUsedForCatalog =
			lastModelByHarness[harnessId] ||
			(connectedHarness === harnessId ? session.listedModelId : "");
		setModelId((current) => {
			const next = composerModelIdForCatalog({
				requestedId: current,
				catalog: models,
				lastUsedForCatalog,
				excludedIds: session.blockedListedModelIds,
			});
			return next === current ? current : next;
		});
	}, [
		harnessId,
		lastModelByHarness,
		session.blockedListedModelIds,
		session.connection,
		session.listedModelId,
		models,
	]);

	useEffect(() => {
		if (!modelId || !models.some((model) => model.id === modelId)) return;
		setLastModelByHarness((current) =>
			current[harnessId] === modelId
				? current
				: { ...current, [harnessId]: modelId },
		);
	}, [harnessId, modelId, models]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Model changes must reset overrides even when their default reasoning levels match.
	useEffect(() => {
		setReasoningId(selectedModel?.reasoning?.defaultLevelId ?? "");
		setFast(false);
	}, [selectedModel?.id, selectedModel?.reasoning?.defaultLevelId]);

	useEffect(() => {
		setOptimisticItems((current) =>
			current.filter(
				(item) =>
					item.kind !== "userMessage" ||
					!session.items.some(
						(existing) =>
							existing.kind === "userMessage" && existing.text === item.text,
					),
			),
		);
	}, [session.items]);

	function sendText(text: string) {
		if (!composerCanSend(text, false)) return;
		captureAnalytics("prompt_submitted", {
			runtime: harnessId,
			attempts: leaderCount,
		});
		const userMessageId = crypto.randomUUID();
		setOptimisticItems((current) => [
			...current,
			{
				kind: "userMessage",
				id: SessionItemId(userMessageId),
				text,
			},
		]);
		const reasoning = resolveReasoningLevel(selectedModel, reasoningId);
		onSend(text, modelId, {
			...(leaderCount === 1 && reasoning?.id
				? { reasoningId: reasoning.id }
				: {}),
			...(leaderCount === 1 && fast ? { fast: true } : {}),
			...(competitionMode && leaderCount > 1
				? { leaderCount, attemptModelIds, userMessageId }
				: {}),
		});
		setDraft("");
	}

	function sendDraft() {
		if (slashDraft) {
			const command = visibleSlashCommands[slashIndex];
			if (command) runSlashCommand(command);
			return;
		}
		sendText(draft.trim());
	}

	function runSlashCommand(command: SlashCommand) {
		if (command.availability !== "ready") return;
		if (command.id === "stop") {
			onStop();
			setDraft("");
			return;
		}
		if (command.id === "retry" && lastUserText) {
			setDraft("");
			sendText(lastUserText);
			return;
		}
		if (command.id === "model") {
			setDraft("");
			document.getElementById("session-model-select")?.focus();
			return;
		}
		if (
			command.id === "files" ||
			command.id === "diff" ||
			command.id === "terminal" ||
			command.id === "desktop"
		) {
			onOpenInspector(command.id);
			setDraft("");
		}
	}

	function handleComposerKey(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (!slashDraft || visibleSlashCommands.length === 0) return false;
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSlashIndex((index) => (index + 1) % visibleSlashCommands.length);
			return true;
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setSlashIndex(
				(index) =>
					(index - 1 + visibleSlashCommands.length) %
					visibleSlashCommands.length,
			);
			return true;
		}
		if (event.key === "Escape") {
			event.preventDefault();
			setDraft("");
			return true;
		}
		if (event.key === "Tab" || event.key === "Enter") {
			const command = visibleSlashCommands[slashIndex];
			if (!command) return false;
			event.preventDefault();
			runSlashCommand(command);
			return true;
		}
		return false;
	}

	return (
		<section
			className="session-launcher"
			aria-labelledby="session-title"
			data-layout={followUpLayout ? "chat" : "empty"}
		>
			<h1 id="session-title" className="sr-only">
				Session
			</h1>
			<SessionTimeline
				recoveryControls={
					onRecovered && selectedProject && session.agentSessionId
						? (messageId) => {
								const point = recoveryPoints.data?.find(
									(point) => point.messageId === messageId,
								);
								if (!point) return null;
								return (
									<ConversationRecovery
										codeAvailable={point.codeAvailable}
										busy={busy || session.turnStatus === "running"}
										onRecover={async (mode) => {
											if (!session.agentSessionId)
												throw new Error("Session is unavailable.");
											const recovered = await recoverPoint({
												data: {
													projectId: selectedProject.id,
													sessionId: session.agentSessionId,
													messageId,
													mode,
												},
											});
											await onRecovered(recovered.id, recovered.prompt);
											if (recovered.prompt) setDraft(recovered.prompt);
											await recoveryPoints.refetch();
										}}
									/>
								);
							}
						: undefined
				}
				tasks={childTasks}
				items={items}
				turnStatus={turnStatus}
				fill={followUpLayout}
				onOpenFile={onOpenFile}
				competitions={competitions}
				onOpenCandidate={onOpenCandidate}
			/>
			<div className="session-dock">
				{visibleSlashCommands.length === 0 ? (
					<ProjectContext
						projects={projects}
						selectedProject={selectedProject}
						onSelectProject={onSelectProject}
						projectLocked={followUpLayout}
						repairModel={
							selectedModel && (harnessId === "api" || harnessId === "codex")
								? {
										harness: harnessId,
										modelId: selectedModel.id,
										allowApi: false,
									}
								: undefined
						}
						repairModelLabel={selectedModel?.label}
						projectPickerOpen={projectPickerOpen}
						onProjectPickerOpenChange={onProjectPickerOpenChange}
					/>
				) : null}
				<div className="composer-shell">
					<div className="session-composer">
						{visibleSlashCommands.length > 0 ? (
							<SlashCommandPalette
								commands={visibleSlashCommands}
								activeIndex={slashIndex}
								onHover={setSlashIndex}
								onSelect={runSlashCommand}
							/>
						) : null}

						<TaskInput
							value={draft}
							onChange={setDraft}
							onSubmit={sendDraft}
							disabled={busy}
							placeholder={
								followUpLayout
									? "Follow up…"
									: "What would you like to work on?"
							}
							onKeyDown={handleComposerKey}
						/>
						{attachments.length > 0 && (
							<ul className="session-attachments" aria-label="Attached files">
								{attachments.map((file, index) => (
									<li key={`${file.name}-${file.lastModified}-${file.size}`}>
										<span title={file.name}>{file.name}</span>
										<button
											type="button"
											aria-label={`Remove ${file.name}`}
											onClick={() =>
												setAttachments((files) =>
													files.filter((_, fileIndex) => fileIndex !== index),
												)
											}
										>
											<X size={14} />
										</button>
									</li>
								))}
							</ul>
						)}
						<div className="session-toolbar">
							<SessionControls
								contextIndicator={
									harnessId === "codex" ||
									recordedContextUsage(session.items) ? (
										<ContextUsage
											context={
												session.usage?.context ??
												recordedContextUsage(session.items)?.context
											}
											compacting={
												session.usage?.compacting ??
												recordedContextUsage(session.items)?.compacting
											}
										/>
									) : null
								}
								connectionContent={
									harnessLoginShouldShow({
										harnessReady,
										harnessId,
										connection: session.connection,
									}) ? (
										<HarnessLogin
											harnessId={harnessId}
											connection={session.connection}
											busy={busy}
											onConnect={onConnect}
										/>
									) : null
								}
								providerConnected={
									harnessReady ||
									(harnessId === "codex" && session.snapshotAvailable)
								}
								catalogStatus={
									catalog.isPending
										? "loading"
										: catalog.isError
											? "error"
											: "ready"
								}
								onConnect={
									catalog.isError
										? () => {
												void catalog.refetch();
											}
										: onConnect
								}
								harnessId={harnessId}
								onHarnessIdChange={onHarnessIdChange}
								models={models}
								modelId={modelId}
								listedModelId={modelId || session.listedModelId}
								onModelIdChange={setModelId}
								multipleModels={competitionMode && multipleModels}
								modelRuns={modelRuns}
								onMultipleModelsChange={(enabled) => {
									setMultipleModels(enabled);
									if (enabled)
										setModelRuns([
											{ modelId: modelId || models[0]?.id || "", count: 2 },
										]);
								}}
								onModelRunsChange={(runs) => {
									setModelRuns(runs);
									if (runs[0] && runs[0].modelId !== modelId) {
										setModelId(runs[0].modelId);
										setReasoningId("");
										setFast(false);
									}
								}}
								parallelAvailable={competitionMode}
								reasoningId={reasoningId}
								onReasoningIdChange={setReasoningId}
								fast={fast}
								onFastChange={setFast}
								onAttachFiles={(selected) =>
									setAttachments((files) => {
										const additions = selected.filter(
											(file) =>
												!files.some(
													(existing) =>
														existing.name === file.name &&
														existing.size === file.size &&
														existing.lastModified === file.lastModified,
												),
										);
										return [...files, ...additions];
									})
								}
							/>
							{turnStatus === "running" && activeCompetition ? (
								<button
									type="button"
									className="session-send"
									aria-label="Stop independent agents"
									onClick={onStop}
									title="Stop independent agents"
								>
									<MatrixDotLoader />
								</button>
							) : turnStatus === "running" ? (
								<button
									type="button"
									className="session-send"
									aria-label="Stop"
									title="Stop this run"
									onClick={onStop}
								>
									<span className="send-face send-face-stop">
										<Square className="size-3.5" fill="currentColor" />
									</span>
								</button>
							) : (
								<button
									type="button"
									className="session-send"
									aria-label="Send"
									disabled={!composerCanSend(draft, Boolean(slashDraft))}
									title={
										canResumeFollowUp
											? "Resume and send"
											: harnessReady
												? session.canSend
													? "Send task"
													: "Wait for this harness to finish starting"
												: composerCanStartSignIn({
															harnessId,
															connection: session.connection,
															snapshotAvailable: session.snapshotAvailable,
															busy,
															draft,
															slashDraft: Boolean(slashDraft),
														})
													? "Send"
													: harnessRequiresAccountLogin(harnessId)
														? `Sign in to ${agentProviderById(harnessId).name} to start a session`
														: `Connect ${agentProviderById(harnessId).name} to start a session`
									}
									onClick={sendDraft}
								>
									<span className="send-face">
										<ArrowUp className="size-4" />
									</span>
								</button>
							)}
						</div>
						{selectedModel?.notice ? (
							<p className="model-provider-notice">{selectedModel.notice}</p>
						) : null}
					</div>
				</div>
			</div>
		</section>
	);
}
