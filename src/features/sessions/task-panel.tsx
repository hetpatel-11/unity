import {
	Check,
	Circle,
	CircleAlert,
	Clock3,
	CornerDownRight,
} from "lucide-react";
import type { CSSProperties } from "react";
import { MatrixDotLoader } from "#/components/ui/matrix-dot-loader";
import type { AgentTask, AgentTaskStatus } from "#/domain/agent-task";

const statusLabels: Record<AgentTaskStatus, string> = {
	draft: "Planned",
	working: "Working",
	waiting: "Waiting",
	idle: "Idle",
	done: "Completed",
	failed: "Failed",
};

export function TaskPanel({
	tasks,
	winnerId,
	comparison = false,
}: {
	tasks: readonly AgentTask[];
	winnerId?: string | null;
	comparison?: boolean;
}) {
	const completed = tasks.filter((task) => task.status === "done").length;
	return (
		<section className="task-panel" aria-label="Tasks">
			<header className="task-panel-header">
				<h2>
					Tasks <span className="task-count">{tasks.length}</span>
				</h2>
				{tasks.length > 0 ? (
					<span className="task-count">
						{completed}/{tasks.length} completed
					</span>
				) : null}
			</header>
			{tasks.length === 0 ? (
				<p className="task-empty">
					Delegated work will appear here when the agent creates tasks.
				</p>
			) : (
				<ol className="task-list">
					{tasks.map((task) => (
						<li
							className="task-row"
							key={task.id}
							style={
								{ "--task-depth": Math.max(0, task.depth - 1) } as CSSProperties
							}
						>
							{task.depth > 1 ? (
								<CornerDownRight
									className="task-branch"
									size={13}
									aria-hidden="true"
								/>
							) : null}
							<span
								className="task-status"
								role="img"
								data-status={task.status}
								aria-label={statusLabels[task.status]}
							>
								{task.status === "done" ? (
									<Check size={14} />
								) : task.status === "failed" ? (
									<CircleAlert size={14} />
								) : task.status === "waiting" ? (
									<Clock3 size={14} />
								) : task.status === "working" ? (
									<MatrixDotLoader />
								) : (
									<Circle size={12} fill="none" />
								)}
							</span>
							<div className="task-row-copy">
								<div>
									<span className="task-label">
										{comparison && task.depth === 1
											? task.label.replace(/^Task /, "Agent ")
											: task.label}
									</span>
									<strong>
										{task.status === "done" ? (
											<s>
												{comparison && task.depth === 1
													? "Independent implementation"
													: task.title}
											</s>
										) : comparison && task.depth === 1 ? (
											"Independent implementation"
										) : (
											task.title
										)}
										{winnerId === task.id ? (
											<span className="task-winner"> Selected</span>
										) : null}
									</strong>
								</div>
								<small>
									{task.listedModelId ?? task.harnessId}
									<span aria-hidden="true"> · </span>
									{statusLabels[task.status]}
								</small>
							</div>
						</li>
					))}
				</ol>
			)}
		</section>
	);
}
