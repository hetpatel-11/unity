import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, FolderGit2, RefreshCw, Search } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	addProjectCopy,
	addProjectPhase,
	filterRepositories,
} from "#/domain/add-project";
import type { Project, RepositoryChoice } from "../../domain/projects";
import { requestJson } from "./api";
import "./add-project-form.css";

export function AddProjectForm({
	variant,
	onAdded,
	onCancel,
}: {
	variant: "page" | "sidebar" | "settings";
	onAdded: (project: Project) => void;
	onCancel?: () => void;
}) {
	const [query, setQuery] = useState("");
	const [selected, setSelected] = useState<RepositoryChoice[]>([]);
	const [name, setName] = useState("");
	const nameId = useId();
	const suggestedName = selected
		.map((repo) => repo.fullName.split("/").at(-1))
		.join(" + ")
		.slice(0, 100);
	const [callbackFailed, setCallbackFailed] = useState(false);
	useEffect(() => {
		setCallbackFailed(
			new URLSearchParams(window.location.search).get("connection") ===
				"failed",
		);
	}, []);
	const repositories = useQuery({
		queryKey: ["github", "repositories"],
		queryFn: () =>
			requestJson<{
				repositories: RepositoryChoice[];
				installationUrl: string;
			}>("/api/github/repositories"),
		retry: false,
	});
	const connection = useMutation({
		mutationFn: () => requestJson<{ url: string }>("/api/github/connect", {}),
		onSuccess: ({ url }) => {
			window.location.assign(url);
		},
	});
	const save = useMutation({
		mutationFn: () =>
			requestJson<Project>("/api/projects", {
				name: name.trim() || suggestedName,
				repositories: selected.map((repository) => ({
					installationId: repository.installationId,
					repositoryId: repository.repositoryId,
					branch: repository.defaultBranch,
				})),
			}),
		onSuccess: onAdded,
	});
	const phase = addProjectPhase({
		loading: repositories.isPending,
		githubReady: Boolean(repositories.data),
	});
	const copy = addProjectCopy(phase);
	const visibleRepos = useMemo(
		() => filterRepositories(repositories.data?.repositories ?? [], query),
		[query, repositories.data?.repositories],
	);
	const compact = variant !== "page";

	return (
		<div
			className={
				variant === "sidebar"
					? "add-project add-project-sidebar"
					: variant === "settings"
						? "add-project add-project-settings"
						: "add-project add-project-page"
			}
		>
			<div className="project-create-header">
				<div>
					{compact ? (
						<h2>{phase === "connect" ? copy.title : "New project"}</h2>
					) : null}
					<p>
						{phase === "connect"
							? copy.description
							: "Choose the repositories you’ll work with."}
					</p>
				</div>
				{repositories.data ? (
					<Button
						variant="ghost"
						size="icon"
						aria-label="Refresh repositories"
						title="Refresh repositories"
						disabled={repositories.isFetching || save.isPending}
						onClick={() => void repositories.refetch()}
					>
						<RefreshCw size={14} />
					</Button>
				) : null}
			</div>
			{callbackFailed ? (
				<p role="alert">GitHub was canceled or expired. Connect it again.</p>
			) : null}
			{phase === "loading" ? <p role="status">Loading repositories…</p> : null}
			{phase === "connect" ? (
				<>
					{repositories.error ? (
						<p role="status">{repositories.error.message}</p>
					) : null}
					<button
						type="button"
						className="setup-primary"
						disabled={connection.isPending}
						onClick={() => connection.mutate()}
					>
						{connection.isPending ? "Opening GitHub…" : "Connect GitHub"}
					</button>
				</>
			) : null}
			{repositories.data ? (
				<>
					<div className="project-create-search">
						<Search size={16} aria-hidden="true" />
						<input
							aria-label="Search repositories"
							type="search"
							placeholder="Search repositories"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
						/>
					</div>
					<div className="project-create-caption">
						<span>
							{selected.length ? `${selected.length} selected` : "Repositories"}
						</span>
						{selected.length ? (
							<button
								type="button"
								disabled={save.isPending}
								onClick={() => setSelected([])}
							>
								Clear selection
							</button>
						) : (
							<span>Up to 10</span>
						)}
					</div>
					<ul className="add-project-repos" aria-label="Repositories">
						{visibleRepos.length === 0 ? (
							<li className="add-project-empty">
								{repositories.data.repositories.length
									? "No repositories match."
									: "No writable repositories yet."}
							</li>
						) : (
							visibleRepos.map((repo) => {
								const id = `${repo.installationId}:${repo.repositoryId}`;
								const checked = selected.some(
									(item) => item.repositoryId === repo.repositoryId,
								);
								return (
									<li key={id}>
										<button
											type="button"
											disabled={
												save.isPending || (!checked && selected.length >= 10)
											}
											aria-pressed={checked}
											aria-label={repo.fullName}
											onClick={() =>
												setSelected((current) =>
													checked
														? current.filter(
																(item) =>
																	item.repositoryId !== repo.repositoryId,
															)
														: [...current, repo],
												)
											}
										>
											<FolderGit2
												className="add-project-repo-icon"
												size={16}
												aria-hidden="true"
											/>
											<span className="add-project-repo-label">
												<span className="project-create-owner">
													{repo.fullName.split("/")[0]} /{" "}
												</span>
												{repo.fullName.split("/")[1]}
											</span>
											{checked ? (
												<Check
													className="project-create-selected"
													size={15}
													aria-hidden="true"
												/>
											) : null}
										</button>
									</li>
								);
							})
						)}
					</ul>
					<div className="project-create-details">
						<label className="add-project-field" htmlFor={nameId}>
							Project name{" "}
							<span className="project-create-optional">Optional</span>
						</label>
						<input
							id={nameId}
							className="add-project-search"
							value={name}
							maxLength={100}
							placeholder={suggestedName || "e.g. My app"}
							disabled={save.isPending}
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="project-create-access">
						<a
							href={repositories.data.installationUrl}
							target="_blank"
							rel="noreferrer"
						>
							Missing a repository? Manage GitHub access
						</a>
					</div>
				</>
			) : null}
			{(connection.error || save.error) && (
				<p role="alert">{connection.error?.message || save.error?.message}</p>
			)}
			<div className="project-create-footer">
				{onCancel ? (
					<Button
						type="button"
						variant="ghost"
						size="lg"
						disabled={save.isPending}
						onClick={onCancel}
					>
						Cancel
					</Button>
				) : (
					<span />
				)}
				{repositories.data ? (
					<Button
						type="button"
						size="lg"
						disabled={
							!selected.length || selected.length > 10 || save.isPending
						}
						onClick={() => save.mutate()}
					>
						{save.isPending ? "Creating…" : "Create project"}
					</Button>
				) : null}
			</div>
		</div>
	);
}
