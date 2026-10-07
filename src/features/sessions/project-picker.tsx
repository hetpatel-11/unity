import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, GitBranch, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import {
	addedProjectBranch,
	projectPickerRows,
	scratchRepositoryName,
} from "#/domain/add-project";
import type { Project, RepositoryChoice } from "#/domain/projects";
import { AddProjectForm } from "../projects/add-project-form";
import { requestJson } from "../projects/api";

export function ProjectPicker({
	projects,
	selectedProject,
	onSelectProject,
	open,
	onOpenChange,
}: {
	projects: Project[];
	selectedProject?: Project;
	onSelectProject: (id: string) => void;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
	const pickerOpen = open ?? uncontrolledOpen;
	function setPickerOpen(next: boolean) {
		onOpenChange?.(next);
		if (open === undefined) setUncontrolledOpen(next);
	}
	const [query, setQuery] = useState("");
	const [creating, setCreating] = useState(false);
	const [addingProject, setAddingProject] = useState(false);
	const [scratchName, setScratchName] = useState("");
	const repositories = useQuery({
		queryKey: ["github", "repositories"],
		queryFn: () =>
			requestJson<{
				repositories: RepositoryChoice[];
				installationUrl: string;
			}>("/api/github/repositories"),
		retry: false,
		enabled: pickerOpen,
	});
	const connection = useMutation({
		mutationFn: () => requestJson<{ url: string }>("/api/github/connect", {}),
		onSuccess: ({ url }) => {
			window.location.assign(url);
		},
	});
	const save = useMutation({
		mutationFn: (repository: RepositoryChoice) =>
			requestJson<Project>("/api/projects", {
				installationId: repository.installationId,
				repositoryId: repository.repositoryId,
				branch: addedProjectBranch(repository),
			}),
		onSuccess: async (project) => {
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			onSelectProject(project.id);
			setPickerOpen(false);
			setQuery("");
		},
	});
	const create = useMutation({
		mutationFn: (name: string) =>
			requestJson<Project>("/api/github/repositories", { name }),
		onSuccess: async (project) => {
			await queryClient.invalidateQueries({ queryKey: ["projects"] });
			await queryClient.invalidateQueries({
				queryKey: ["github", "repositories"],
			});
			onSelectProject(project.id);
			setPickerOpen(false);
			setQuery("");
			setCreating(false);
			setScratchName("");
		},
	});
	const rows = useMemo(
		() =>
			projectPickerRows({
				projects,
				repositories: repositories.data?.repositories ?? [],
				query,
				selectedProjectId: selectedProject?.id,
			}),
		[projects, query, repositories.data?.repositories, selectedProject?.id],
	);
	const scratch = scratchRepositoryName(scratchName);

	function choose(row: (typeof rows)[number]) {
		if (row.project) {
			onSelectProject(row.project.id);
			setPickerOpen(false);
			setQuery("");
			return;
		}
		if (row.repository) save.mutate(row.repository);
	}

	return (
		<Popover
			open={pickerOpen}
			onOpenChange={(next) => {
				setPickerOpen(next);
				if (!next) {
					setQuery("");
					setCreating(false);
					setAddingProject(false);
					setScratchName("");
				}
			}}
		>
			<PopoverTrigger
				className="context-select project-select"
				aria-label="Project"
				title={
					selectedProject?.name || selectedProject?.fullName || "Select project"
				}
			>
				<GitBranch size={14} />
				<span>
					{selectedProject?.name ||
						selectedProject?.fullName ||
						"Select project"}
				</span>
				<ChevronDown className="size-3" />
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				collisionPadding={12}
				className="project-picker"
				data-creating={addingProject || undefined}
			>
				{addingProject ? (
					<AddProjectForm
						variant="sidebar"
						onCancel={() => setAddingProject(false)}
						onAdded={async (project) => {
							await queryClient.invalidateQueries({ queryKey: ["projects"] });
							onSelectProject(project.id);
							setAddingProject(false);
							setPickerOpen(false);
						}}
					/>
				) : (
					<>
						<input
							className="project-picker-search"
							type="search"
							placeholder="Search repositories"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							aria-label="Search repositories"
						/>
						<div
							className="project-picker-list"
							role="listbox"
							aria-label="Projects"
						>
							{rows.map((row) => (
								<button
									key={row.key}
									type="button"
									role="option"
									aria-selected={row.selected}
									className="project-picker-choice"
									data-selected={row.selected ? "true" : undefined}
									disabled={save.isPending || create.isPending}
									onClick={() => choose(row)}
								>
									<GitBranch size={14} />
									<span>{row.fullName}</span>
									{row.selected ? <Check size={14} /> : null}
								</button>
							))}
							{rows.length === 0 ? (
								<p className="project-picker-empty">
									{repositories.isPending
										? "Loading repositories…"
										: query.trim()
											? "No repositories match."
											: repositories.data
												? "No repositories yet."
												: "Connect GitHub to see repositories."}
								</p>
							) : null}
						</div>
						{creating ? (
							<form
								className="project-picker-create"
								onSubmit={(event) => {
									event.preventDefault();
									if (scratch) create.mutate(scratch);
								}}
							>
								<input
									className="project-picker-search"
									type="text"
									placeholder="Repository name"
									value={scratchName}
									onChange={(event) => setScratchName(event.target.value)}
									aria-label="New repository name"
								/>
								<button type="submit" disabled={!scratch || create.isPending}>
									{create.isPending ? "Creating…" : "Create"}
								</button>
								<button type="button" onClick={() => setCreating(false)}>
									Cancel
								</button>
							</form>
						) : null}
						<div className="project-picker-actions">
							<button type="button" onClick={() => setAddingProject(true)}>
								New project · select repositories
							</button>
							{creating ? null : (
								<button type="button" onClick={() => setCreating(true)}>
									Create repository
								</button>
							)}
							{repositories.data?.installationUrl ? (
								<a
									href={repositories.data.installationUrl}
									target="_blank"
									rel="noreferrer"
								>
									Add repositories
								</a>
							) : (
								<button
									type="button"
									disabled={connection.isPending}
									onClick={() => connection.mutate()}
								>
									{connection.isPending ? "Opening GitHub…" : "Connect GitHub"}
								</button>
							)}
							<button
								type="button"
								disabled={repositories.isFetching}
								onClick={() => void repositories.refetch()}
							>
								<RefreshCw size={12} />
								Refresh
							</button>
						</div>
						{save.error ||
						create.error ||
						connection.error ||
						repositories.error ? (
							<p className="project-picker-error" role="alert">
								{save.error?.message ||
									create.error?.message ||
									connection.error?.message ||
									repositories.error?.message}
							</p>
						) : null}
					</>
				)}
			</PopoverContent>
		</Popover>
	);
}
