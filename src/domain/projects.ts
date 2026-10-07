import { z } from "zod";
export const projectSelection = z.object({
	installationId: z.number().int().positive().safe(),
	repositoryId: z.number().int().positive().safe(),
	branch: z.string().min(1).max(255),
});
export type ProjectSelection = z.infer<typeof projectSelection>;
export const projectGroupSelection = z
	.object({
		name: z.string().trim().min(1).max(100),
		repositories: z.array(projectSelection).min(1).max(10),
	})
	.strict()
	.superRefine((selection, ctx) => {
		if (
			new Set(selection.repositories.map((repo) => repo.repositoryId)).size !==
			selection.repositories.length
		)
			ctx.addIssue({
				code: "custom",
				message: "Select each repository only once.",
			});
	});
export type ProjectGroupSelection = z.infer<typeof projectGroupSelection>;
export interface ProjectRepository {
	repositoryId: number;
	installationId: number;
	fullName: string;
	branch: string;
}
export interface RepositoryChoice {
	installationId: number;
	repositoryId: number;
	fullName: string;
	defaultBranch: string;
}
export interface Project {
	id: string;
	name?: string;
	repositories?: ProjectRepository[];
	repositoryId: number;
	installationId: number;
	fullName: string;
	branch: string;
}

export function repositoriesForProject(project: Project): ProjectRepository[] {
	return project.repositories?.length
		? project.repositories
		: [
				{
					repositoryId: project.repositoryId,
					installationId: project.installationId,
					fullName: project.fullName,
					branch: project.branch,
				},
			];
}

export function projectFolderName(fullName: string) {
	const slash = fullName.lastIndexOf("/");
	return slash === -1 ? fullName : fullName.slice(slash + 1);
}

export function projectDisplayName(
	project: Pick<Project, "name" | "fullName">,
) {
	return project.name?.trim() || projectFolderName(project.fullName);
}

export function selectedProjectIdAfterDelete(input: {
	readonly projects: readonly { readonly id: string }[];
	readonly selectedProjectId: string | undefined;
	readonly deletedProjectId: string;
}): string | undefined {
	if (input.selectedProjectId !== input.deletedProjectId) {
		return input.selectedProjectId;
	}
	return input.projects.find((project) => project.id !== input.deletedProjectId)
		?.id;
}

export function projectMachineRefsToDestroy(input: {
	readonly sessionProviderRefs: readonly (string | null | undefined)[];
	readonly templateProviderRef: string | null | undefined;
}): string[] {
	return [
		...new Set(
			[...input.sessionProviderRefs, input.templateProviderRef].filter(
				(ref): ref is string => Boolean(ref),
			),
		),
	];
}
