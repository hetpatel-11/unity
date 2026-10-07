import type { Project, RepositoryChoice } from "./projects";

export type AddProjectPhase = "loading" | "connect" | "choose";

export function addProjectPhase(input: {
	readonly loading: boolean;
	readonly githubReady: boolean;
}): AddProjectPhase {
	if (input.loading) return "loading";
	if (!input.githubReady) return "connect";
	return "choose";
}

export function addProjectCopy(phase: AddProjectPhase) {
	if (phase === "connect") {
		return {
			title: "Connect GitHub",
			description:
				"Grant ytimesy access to the repositories you want to work on.",
		};
	}
	return {
		title: "Add project",
		description: "Select repositories to share one project environment.",
	};
}

export function addedProjectBranch(
	repository: Pick<
		RepositoryChoice,
		"fullName" | "repositoryId" | "defaultBranch"
	>,
) {
	return repository.defaultBranch;
}

export function filterRepositories(
	repositories: readonly RepositoryChoice[],
	query: string,
): RepositoryChoice[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...repositories];
	return repositories.filter((repository) =>
		repository.fullName.toLowerCase().includes(needle),
	);
}

export function repositoryChoiceValue(repository: RepositoryChoice) {
	return `${repository.installationId}:${repository.repositoryId}`;
}

export function repositoryIsAdded(
	projects: readonly Pick<Project, "installationId" | "repositoryId">[],
	repository: Pick<RepositoryChoice, "installationId" | "repositoryId">,
) {
	return projects.some(
		(project) =>
			project.installationId === repository.installationId &&
			project.repositoryId === repository.repositoryId,
	);
}

export function filterProjects(
	projects: readonly Project[],
	query: string,
): Project[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return [...projects];
	return projects.filter((project) =>
		[
			project.name,
			project.fullName,
			...(project.repositories?.map((repo) => repo.fullName) ?? []),
		].some((name) => name?.toLowerCase().includes(needle)),
	);
}

export function projectPickerLists(input: {
	readonly projects: readonly Project[];
	readonly repositories: readonly RepositoryChoice[];
	readonly query: string;
}) {
	return {
		added: filterProjects(input.projects, input.query),
		available: filterRepositories(input.repositories, input.query).filter(
			(repository) => !repositoryIsAdded(input.projects, repository),
		),
	};
}

export function scratchRepositoryName(value: string) {
	const name = value.trim();
	return /^[A-Za-z0-9_.-]{1,100}$/.test(name) ? name : null;
}

export type ProjectPickerRow = {
	readonly key: string;
	readonly fullName: string;
	readonly selected: boolean;
	readonly project?: Project;
	readonly repository?: RepositoryChoice;
};

export function projectPickerRows(input: {
	readonly projects: readonly Project[];
	readonly repositories: readonly RepositoryChoice[];
	readonly query: string;
	readonly selectedProjectId?: string;
}): ProjectPickerRow[] {
	const seen = new Set<string>();
	const rows: ProjectPickerRow[] = [];
	for (const repository of filterRepositories(
		input.repositories,
		input.query,
	)) {
		const project = input.projects.find(
			(candidate) =>
				!candidate.name &&
				candidate.installationId === repository.installationId &&
				candidate.repositoryId === repository.repositoryId,
		);
		const key = repositoryChoiceValue(repository);
		seen.add(key);
		rows.push({
			key,
			fullName: repository.fullName,
			selected: project?.id === input.selectedProjectId,
			project,
			repository,
		});
	}
	for (const project of filterProjects(input.projects, input.query)) {
		const key = `${project.installationId}:${project.repositoryId}`;
		if (!project.name && seen.has(key)) continue;
		rows.push({
			key: project.id,
			fullName: project.name || project.fullName,
			selected: project.id === input.selectedProjectId,
			project,
		});
	}
	return rows.sort((left, right) =>
		left.fullName.localeCompare(right.fullName),
	);
}
