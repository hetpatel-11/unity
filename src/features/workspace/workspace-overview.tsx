import {
	ChevronRight,
	Files,
	GitCompare,
	GitPullRequest,
	Monitor,
	Terminal,
} from "lucide-react";
import { MatrixDotLoader } from "#/components/ui/matrix-dot-loader";
import type { AgentCompetition } from "#/domain/agent-competition";
import type { AgentTask } from "#/domain/agent-task";
import { fileChangeTotals } from "#/domain/diff-preview";
import type { FileChangeEntry, SessionItem } from "#/domain/session-item";
import {
	type ListedPullRequest,
	sidebarChatPrNeedFromPullRequest,
	sidebarChatPrNeedLabel,
} from "#/domain/sidebar-pr";
import type { WorkspaceDesktop } from "#/domain/workspace-desktop";
import { AgentMarkdown } from "../sessions/agent-markdown";
import { TaskPanel } from "../sessions/task-panel";
import { TodoList } from "../sessions/todo-list";
import type { ToolsView } from "./workspace-inspector";

export function WorkspaceOverview({
	tasks,
	competitions = [],
	items,
	changes,
	pullRequests,
	repository,
	desktop,
	onOpen,
}: {
	tasks: readonly AgentTask[];
	competitions?: readonly AgentCompetition[];
	items: readonly SessionItem[];
	changes: readonly FileChangeEntry[];
	pullRequests: readonly ListedPullRequest[];
	repository?: string;
	desktop: WorkspaceDesktop;
	onOpen: (view: ToolsView) => void;
}) {
	const plan = items.filter((item) => item.kind === "plan").at(-1);
	const todoPlan = items
		.filter((item) => item.kind === "plan" && item.todos !== undefined)
		.at(-1);
	const totals = fileChangeTotals(changes);
	const candidateIds = new Set(
		competitions.flatMap((group) =>
			group.candidates.map((candidate) => candidate.id),
		),
	);
	const cards = [
		{
			view: "diff",
			title: "Diffs",
			detail: `${changes.length} ${changes.length === 1 ? "file" : "files"} changed`,
			icon: GitCompare,
		},
		{
			view: "files",
			title: "Files",
			detail: repository ?? "Workspace files",
			icon: Files,
		},
		{
			view: "desktop",
			title: "Desktop",
			detail:
				desktop.status === "stopped"
					? "Not running"
					: desktop.status === "running"
						? "Running"
						: desktop.status === "starting"
							? "Starting"
							: "Unavailable",
			icon: Monitor,
		},
		{
			view: "terminal",
			title: "Terminal",
			detail: "Workspace shell",
			icon: Terminal,
		},
	] as const;
	return (
		<section className="workspace-overview" aria-label="Overview">
			{competitions.map((competition, index) => (
				<section
					key={competition.id}
					className="overview-section competition-overview"
					aria-label={`Independent agents for task ${index + 1}`}
				>
					<h2>
						Task {index + 1} <span>{competition.leaderCount} agents</span>
					</h2>
					<p>
						{competition.status === "complete"
							? competition.winnerSessionId
								? "Agent selected"
								: "No winner selected"
							: competition.status === "failed"
								? "Could not complete comparison"
								: competition.status === "judging"
									? "Comparing results"
									: "Agents are implementing the same task separately"}
					</p>
					{competition.status === "working" ||
					competition.status === "queued" ||
					competition.status === "judging" ? (
						<MatrixDotLoader />
					) : null}
					{competition.errorMessage ? (
						<small>{competition.errorMessage}</small>
					) : null}
					{tasks.some((task) =>
						competition.candidates.some(
							(candidate) => candidate.id === task.id,
						),
					) ? (
						<TaskPanel
							tasks={tasks.filter((task) =>
								competition.candidates.some(
									(candidate) => candidate.id === task.id,
								),
							)}
							winnerId={competition.winnerSessionId}
							comparison
						/>
					) : null}
				</section>
			))}
			{todoPlan?.kind === "plan" && todoPlan.todos?.length ? (
				<TodoList todos={todoPlan.todos} />
			) : null}
			{plan?.text && !todoPlan ? (
				<section className="overview-section">
					<h2>Plan</h2>
					<AgentMarkdown text={plan.text} />
				</section>
			) : null}
			{tasks.some((task) => !candidateIds.has(task.id)) ? (
				<TaskPanel tasks={tasks.filter((task) => !candidateIds.has(task.id))} />
			) : null}
			{pullRequests.length > 0 ? (
				<section className="overview-section">
					<h2>
						Pull requests <span>{pullRequests.length}</span>
					</h2>
					{pullRequests.map((pr) => (
						<a
							key={pr.number}
							className="overview-pr"
							href={pr.url}
							target="_blank"
							rel="noreferrer"
						>
							<GitPullRequest size={16} />
							<span>
								<strong>#{pr.number}</strong> {pr.head}
								<small>
									{sidebarChatPrNeedLabel(sidebarChatPrNeedFromPullRequest(pr))}
								</small>
							</span>
							<ChevronRight size={14} />
						</a>
					))}
				</section>
			) : null}
			<div className="overview-cards">
				{cards.map((card) => (
					<button
						key={card.view}
						className="overview-card"
						type="button"
						onClick={() => onOpen(card.view)}
					>
						<card.icon size={19} />
						<span>
							<strong>{card.title}</strong>
							<small>{card.detail}</small>
						</span>
						{card.view === "diff" ? (
							<span className="overview-diff-counts">
								<span>+{totals.additions}</span>{" "}
								<span>−{totals.deletions}</span>
							</span>
						) : null}
						<ChevronRight size={15} />
					</button>
				))}
			</div>
		</section>
	);
}
