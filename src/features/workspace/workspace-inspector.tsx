import { ListTodo, Plus, X } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { type ReactNode, useEffect, useState } from "react";
import type { FileChangeEntry } from "#/domain/session-item";
import type { WorkspaceDesktop } from "#/domain/workspace-desktop";
import { DesktopInspector } from "./desktop-inspector";
import { DiffInspector } from "./diff-inspector";
import { FilesInspector } from "./files-inspector";
import { TerminalInspector } from "./terminal-inspector";

export type ToolsView = "files" | "diff" | "terminal" | "desktop";
export type InspectorView = ToolsView | "overview";

const views = {
	files: {
		label: "Files",
		title: "No files yet.",
		description: "The workspace tree will appear here.",
	},
	diff: {
		label: "Diff",
		title: "No changes yet.",
		description: "Changes from this turn will appear here.",
	},
	terminal: {
		label: "Terminal",
		title: "No terminal connected.",
		description: "Start a workspace to use the terminal.",
	},
	desktop: {
		label: "Desktop",
		title: "Shared desktop",
		description:
			"This is the desktop the agent uses for QA. You watch and control the same screen.",
	},
} as const;

export function WorkspaceInspector({
	collapsed,
	activeView,
	onActiveViewChange,
	fileChanges = [],
	selectedFilePath,
	onSelectFilePath,
	desktop,
	desktopBusy,
	onStartDesktop,
	projectId,
	sessionId,
	overview,
}: {
	collapsed: boolean;
	activeView: InspectorView;
	onActiveViewChange: (view: InspectorView) => void;
	fileChanges?: readonly FileChangeEntry[];
	selectedFilePath?: string;
	onSelectFilePath?: (path: string) => void;
	desktop: WorkspaceDesktop;
	desktopBusy: boolean;
	onStartDesktop: () => void;
	projectId?: string;
	sessionId?: string;
	overview: ReactNode;
}) {
	const [openedViews, setOpenedViews] = useState<ToolsView[]>([]);
	useEffect(() => {
		if (activeView !== "overview")
			setOpenedViews((current) =>
				current.includes(activeView) ? current : [...current, activeView],
			);
	}, [activeView]);
	const currentView = activeView === "overview" ? null : views[activeView];
	return (
		<aside
			id="workspace-inspector"
			className="workspace-inspector"
			aria-label="Workspace inspector"
			inert={collapsed}
			aria-hidden={collapsed}
		>
			<div className="inspector-toolbar">
				<div className="inspector-tabs">
					<button
						type="button"
						aria-pressed={activeView === "overview"}
						onClick={() => onActiveViewChange("overview")}
					>
						<ListTodo size={16} />
						Overview
					</button>
					{openedViews.map((view) => (
						<div
							className="inspector-side-tab"
							key={view}
							data-active={activeView === view}
						>
							<button
								type="button"
								key={view}
								aria-pressed={activeView === view}
								onClick={() => onActiveViewChange(view)}
							>
								{views[view].label}
							</button>
							<button
								type="button"
								className="inspector-side-close"
								aria-label={`Close ${views[view].label}`}
								onClick={() => {
									setOpenedViews((current) =>
										current.filter((item) => item !== view),
									);
									if (activeView === view) onActiveViewChange("overview");
								}}
							>
								<X size={13} />
							</button>
						</div>
					))}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger asChild>
							<button
								type="button"
								className="inspector-new-tab"
								aria-label="Open workspace view"
							>
								<Plus size={16} />
							</button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Portal>
							<DropdownMenu.Content
								className="inspector-view-menu"
								sideOffset={6}
								align="start"
							>
								{(Object.keys(views) as ToolsView[]).map((view) => (
									<DropdownMenu.Item
										key={view}
										onSelect={() => onActiveViewChange(view)}
									>
										{views[view].label}
									</DropdownMenu.Item>
								))}
							</DropdownMenu.Content>
						</DropdownMenu.Portal>
					</DropdownMenu.Root>
				</div>
			</div>
			{activeView === "overview" ? (
				overview
			) : activeView === "files" ? (
				<FilesInspector
					changes={fileChanges}
					selectedPath={selectedFilePath}
					onSelectPath={onSelectFilePath ?? (() => undefined)}
					projectId={projectId}
					sessionId={sessionId}
					active={!collapsed && activeView === "files"}
				/>
			) : activeView === "diff" && fileChanges.length > 0 ? (
				<DiffInspector
					changes={fileChanges}
					selectedPath={selectedFilePath}
					projectId={projectId}
					sessionId={sessionId}
				/>
			) : activeView === "desktop" ? null : activeView === "terminal" ? (
				<TerminalInspector
					key={`${projectId ?? ""}:${sessionId ?? ""}`}
					projectId={projectId}
					sessionId={sessionId}
					active={!collapsed && activeView === "terminal"}
				/>
			) : currentView ? (
				<section
					className="inspector-empty"
					data-kind={activeView}
					aria-live="polite"
				>
					<h2>{currentView.title}</h2>
					<p>{currentView.description}</p>
				</section>
			) : null}
			{(activeView === "desktop" || openedViews.includes("desktop")) && (
				<div
					key={`desktop:${projectId ?? ""}:${sessionId ?? ""}`}
					style={{
						display: activeView === "desktop" ? "flex" : "none",
						flex: 1,
						minHeight: 0,
						minWidth: 0,
						overflow: "hidden",
					}}
				>
					<DesktopInspector
						desktop={desktop}
						busy={desktopBusy}
						projectId={projectId}
						sessionId={sessionId}
						onStart={onStartDesktop}
						active={!collapsed && activeView === "desktop"}
					/>
				</div>
			)}
		</aside>
	);
}
