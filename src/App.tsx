import { useEffect, useState } from "react";
import { PanelRight } from "lucide-react";
import { ProjectSidebar } from "./features/workspace/project-sidebar";
import { WorkspacePanes } from "./features/workspace/workspace-panes";
import {
	WorkspaceInspector,
	type InspectorView,
	type ToolsView,
} from "./features/workspace/workspace-inspector";
import { WorkspaceOverview } from "./features/workspace/workspace-overview";
import { SessionLauncher } from "./features/sessions/session-launcher";
import type { PublicCodexSession } from "./domain/session-view";
import type { AgentProviderId } from "./domain/agent-provider";
import type { AgentTask } from "./domain/agent-task";
import type { FileChangeEntry, SessionItem } from "./domain/session-item";
import { SessionItemId } from "./domain/ids";
import { previewModels } from "./demo/catalog-actions";

const project = {
	id: "unity-project",
	repositoryId: 1,
	installationId: 1,
	fullName: "het/unity",
	branch: "main",
};
const desktop = { status: "stopped" } as const;
const initialItems: SessionItem[] = [
	{
		kind: "userMessage",
		id: SessionItemId("initial-request"),
		text: "Give me one place to follow all my coding agents.",
	},
	{
		kind: "agentMessage",
		id: SessionItemId("captain-summary"),
		text: "Welcome to **Unity**. One thread for all your agents.\n\nThis is your existing ytimesy interface, extracted into a standalone frontend. The sample agent activity below shows where the unified briefing can live.\n\n**Frontend agent** finished the navigation. **API agent** is waiting for a decision. **QA agent** is checking the changes.\n\nOpen the workspace panel to inspect their work. This preview uses local sample data; agents are not connected.",
		phase: "final_answer",
	},
];
const changes: FileChangeEntry[] = [
	{
		path: "src/captain.ts",
		change: "add",
		additions: 1,
		deletions: 0,
		preview: '@@ -0,0 +1 @@\n+export const projectName = "Unity";\n',
	},
];
const taskBase = {
	parentSessionId: "unity",
	depth: 1,
	prompt: "",
	placement: "fresh",
	access: "read_write",
	execution: "parallel",
	dependsOnSessionId: null,
	reviewState: "pending",
	branch: null,
	pullRequestUrl: null,
	harnessId: "codex",
	listedModelId: "unity-preview",
	createdAt: "2026-10-07T21:00:00Z",
	updatedAt: "2026-10-07T21:00:00Z",
} as const;
const tasks: AgentTask[] = [
	{
		...taskBase,
		id: "frontend-agent",
		title: "Frontend agent",
		label: "Navigation",
		status: "done",
		summary: "Navigation is ready for review.",
	},
	{
		...taskBase,
		id: "api-agent",
		title: "API agent",
		label: "API contract",
		status: "waiting",
		summary: "Needs your decision on the API contract.",
	},
	{
		...taskBase,
		id: "qa-agent",
		title: "QA agent",
		label: "Verification",
		status: "working",
		summary: "Sample status: checking the changes.",
	},
];

export function App() {
	const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 760);
	const [inspectorOpen, setInspectorOpen] = useState(window.innerWidth >= 1100);
	const [compact, setCompact] = useState(window.innerWidth < 900);
	const [view, setView] = useState<InspectorView>("overview");
	const [ratio, setRatio] = useState(0.58);
	const [items, setItems] = useState(initialItems);
	const [harness, setHarness] = useState<AgentProviderId>("codex");
	const [selectedFile, setSelectedFile] = useState<string>();
	const [notice, setNotice] = useState("");
	useEffect(() => {
		const resize = () => setCompact(window.innerWidth < 900);
		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, []);
	const session: PublicCodexSession = {
		snapshotAvailable: false,
		workspaceId: null,
		agentSessionId: "unity",
		connection: {
			status: "authenticated",
			provider: harness,
			authMode: "local",
			planType: "Frontend preview",
			email: null,
		},
		models: previewModels,
		listedModelId: "unity-preview",
		blockedListedModelIds: [],
		canSend: true,
		canSendSide: false,
		turnStatus: "idle",
		items,
		sideTurnStatus: "idle",
		sideItems: [],
	};
	function openInspector(next: ToolsView) {
		setView(next);
		setInspectorOpen(true);
	}
	function send(text: string) {
		setItems((current) => [
			...current,
			{ kind: "userMessage", id: SessionItemId(crypto.randomUUID()), text },
			{
				kind: "agentMessage",
				id: SessionItemId(crypto.randomUUID()),
				text: "Your message was added locally. Connect the Unity backend to route messages to your agents.",
				phase: "final_answer",
			},
		]);
	}
	function previewNotice() {
		setNotice(
			"This is the frontend preview. Project management and agent connections will be wired to the Unity backend.",
		);
	}
	return (
		<div className="workspace-shell" data-projects-collapsed={!sidebarOpen}>
			<ProjectSidebar
				projects={[project]}
				projectsLoading={false}
				selectedProjectId={project.id}
				onSelectProject={() => {}}
				expanded={sidebarOpen}
				onToggle={() => setSidebarOpen(!sidebarOpen)}
				onAddProject={previewNotice}
				chats={[
					{
						id: "unity",
						title: "All agents",
						turnStatus: "idle",
						harnessId: "codex",
					},
				]}
				selectedChatId="unity"
				hasUserMessage
				onSelectChat={() => {}}
				onNewChat={previewNotice}
				onOpenSettings={previewNotice}
			/>
			<main className="workspace-main">
				<button
					type="button"
					className="workspace-sidebar-toggle workspace-inspector-toggle"
					aria-label={
						inspectorOpen ? "Close right sidebar" : "Open right sidebar"
					}
					onClick={() => setInspectorOpen(!inspectorOpen)}
				>
					<PanelRight size={18} />
				</button>
				<WorkspacePanes
					open={inspectorOpen}
					compact={compact}
					ratio={ratio}
					view={view}
					layout="chat"
					onResize={setRatio}
					onReset={() => setRatio(0.58)}
				>
					<section
						className="welcome-panel"
						aria-label="Unity conversation"
						data-layout="chat"
						inert={compact && inspectorOpen}
						aria-hidden={compact && inspectorOpen}
					>
						<div className="session-title-row">
							<div className="session-title-copy">
								<span className="session-title">All agents</span>
								<span className="session-title-meta">Frontend preview</span>
							</div>
						</div>
						<div className="welcome-content" data-layout="chat">
							<SessionLauncher
								session={session}
								busy={false}
								harnessId={harness}
								onHarnessIdChange={setHarness}
								onSend={send}
								onConnect={previewNotice}
								onStop={previewNotice}
								onOpenInspector={openInspector}
								onOpenFile={(path) => {
									setSelectedFile(path);
									openInspector("files");
								}}
								allowComparison={false}
								projects={[project]}
								selectedProject={project}
								onSelectProject={() => {}}
								listedTitle="All agents"
							/>
						</div>
					</section>
					<WorkspaceInspector
						collapsed={!inspectorOpen}
						activeView={view}
						onActiveViewChange={setView}
						fileChanges={changes}
						selectedFilePath={selectedFile}
						onSelectFilePath={setSelectedFile}
						desktop={desktop}
						desktopBusy={false}
						onStartDesktop={previewNotice}
						projectId={
							view === "terminal" || view === "desktop" ? undefined : project.id
						}
						sessionId={
							view === "terminal" || view === "desktop" ? undefined : "unity"
						}
						overview={
							<WorkspaceOverview
								tasks={tasks}
								items={items}
								changes={changes}
								pullRequests={[]}
								repository={project.fullName}
								desktop={desktop}
								onOpen={openInspector}
							/>
						}
					/>
				</WorkspacePanes>
			</main>
			{notice && (
				<div className="unity-notice" role="status">
					<span>{notice}</span>
					<button onClick={() => setNotice("")} aria-label="Dismiss notice">
						×
					</button>
				</div>
			)}
		</div>
	);
}
