import type { EnvironmentModelRequest } from "#/domain/environment-model";
import type { Project } from "../../domain/projects";
import { WorkspaceStatus } from "../projects/workspace-status";
import { ProjectPicker } from "./project-picker";

export function ProjectContext({
	projects,
	selectedProject,
	onSelectProject,
	projectLocked = false,
	projectPickerOpen,
	onProjectPickerOpenChange,
	repairModel,
	repairModelLabel,
}: {
	projects: Project[];
	selectedProject?: Project;
	onSelectProject: (id: string) => void;
	projectLocked?: boolean;
	projectPickerOpen?: boolean;
	onProjectPickerOpenChange?: (open: boolean) => void;
	repairModel?: EnvironmentModelRequest;
	repairModelLabel?: string;
}) {
	return (
		<div className="session-context">
			{projectLocked ? null : (
				<ProjectPicker
					projects={projects}
					selectedProject={selectedProject}
					onSelectProject={onSelectProject}
					open={projectPickerOpen}
					onOpenChange={onProjectPickerOpenChange}
				/>
			)}
			{selectedProject && (
				<WorkspaceStatus
					projectId={selectedProject.id}
					repairModel={repairModel}
					repairModelLabel={repairModelLabel}
				/>
			)}
		</div>
	);
}
