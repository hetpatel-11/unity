import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "#/demo/client-action";
import { ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { fileBasename } from "#/domain/file-kind";
import { filePreviewKind } from "#/domain/file-preview";
import type { FileChangeEntry } from "#/domain/session-item";
import { fileEditorSaveShortcut } from "#/domain/workspace-explorer";
import {
	fileChangeForPath,
	fileTreeChangeMark,
	firstWorkspaceFilePath,
	type WorkspaceTreeNode,
	workspaceExplorerTree,
	workspacePathForMention,
} from "#/domain/workspace-file-tree";
import { FileTypeIcon } from "../sessions/file-type-icon";
import {
	listWorkspaceExplorerFn,
	readWorkspacePreviewFn,
	readWorkspaceSourceFn,
	writeWorkspaceSourceFn,
} from "#/demo/explorer-actions";
import {
	FilePreview,
	PreviewModeSwitch,
	WorkspaceImagePreview,
} from "./file-preview";

const SourceEditor = lazy(() =>
	import("./source-editor").then((module) => ({
		default: module.SourceEditor,
	})),
);

export function FilesInspector({
	changes,
	selectedPath,
	onSelectPath,
	projectId,
	sessionId,
	active = true,
}: {
	changes: readonly FileChangeEntry[];
	selectedPath?: string;
	onSelectPath: (path: string) => void;
	projectId?: string;
	sessionId?: string;
	active?: boolean;
}) {
	const [drafts, setDrafts] = useState<Record<string, string>>({});
	const [treeOpen, setTreeOpen] = useState(true);
	const filesRef = useRef<HTMLElement>(null);
	const listExplorer = useServerFn(listWorkspaceExplorerFn);
	const readSource = useServerFn(readWorkspaceSourceFn);
	const readPreview = useServerFn(readWorkspacePreviewFn);
	const explorer = useQuery({
		queryKey: ["workspace-explorer", projectId, sessionId],
		queryFn: () =>
			listExplorer({
				data: { projectId, sessionId },
			}),
		enabled: active && Boolean(projectId && sessionId),
		staleTime: 8_000,
	});
	const tree = workspaceExplorerTree(explorer.data?.paths ?? [], changes);
	const activePath =
		(selectedPath
			? workspacePathForMention(
					fileChangeForPath(changes, selectedPath)?.path ?? selectedPath,
					explorer.data?.paths ?? [],
					changes,
				)
			: undefined) ?? firstWorkspaceFilePath(tree);
	const source = useQuery({
		queryKey: ["workspace-source", projectId, sessionId, activePath],
		queryFn: async () => {
			const data = { projectId, sessionId, path: activePath };
			if (filePreviewKind(activePath ?? "") === "code")
				return readSource({ data });
			const preview = await readPreview({ data });
			return preview.kind === "text"
				? { path: activePath ?? "", text: preview.text }
				: null;
		},
		enabled:
			active &&
			Boolean(projectId && sessionId && activePath) &&
			filePreviewKind(activePath ?? "") !== "image",
	});
	return (
		<section ref={filesRef} className="files-inspector" aria-label="Files">
			<div className="files-toolbar">
				<button
					type="button"
					aria-label={treeOpen ? "Hide file tree" : "Show file tree"}
					title={treeOpen ? "Hide file tree" : "Show file tree"}
					aria-expanded={treeOpen}
					onClick={() => setTreeOpen((open) => !open)}
				>
					{treeOpen ? (
						<PanelRightClose size={16} />
					) : (
						<PanelRightOpen size={16} />
					)}
				</button>
			</div>
			<div className="files-content">
				<FileSourcePreview
					key={activePath}
					path={activePath}
					text={source.data?.text ?? null}
					pending={source.isFetching}
					onRetry={() => {
						void explorer.refetch();
						void source.refetch();
					}}
					draft={activePath ? drafts[activePath] : undefined}
					projectId={projectId}
					sessionId={sessionId}
					onDraftChange={(path, next, saved) => {
						setDrafts((current) => {
							if (next === saved) {
								const { [path]: _cleared, ...rest } = current;
								return rest;
							}
							return { ...current, [path]: next };
						});
					}}
				/>
				{treeOpen ? (
					<nav className="file-tree" aria-label="Workspace files">
						{tree.length === 0 ? (
							<p className="file-tree-empty">
								{explorer.isPending
									? "Loading files…"
									: "The workspace tree will appear here."}
							</p>
						) : (
							<FileTreeNodes
								nodes={tree}
								depth={0}
								selectedPath={activePath}
								onSelectPath={(path) => {
									onSelectPath(path);
									if (filesRef.current && filesRef.current.clientWidth <= 600)
										setTreeOpen(false);
								}}
							/>
						)}
					</nav>
				) : null}
			</div>
		</section>
	);
}

function FileSourcePreview({
	path,
	text,
	pending,
	onRetry,
	draft,
	projectId,
	sessionId,
	onDraftChange,
}: {
	path?: string;
	text: string | null;
	pending: boolean;
	onRetry: () => void;
	draft?: string;
	projectId?: string;
	sessionId?: string;
	onDraftChange: (path: string, next: string, saved: string) => void;
}) {
	const queryClient = useQueryClient();
	const previewKind = filePreviewKind(path ?? "");
	const [mode, setMode] = useState<"preview" | "code">(
		previewKind === "code" ? "code" : "preview",
	);
	const writeSource = useServerFn(writeWorkspaceSourceFn);
	const saved = text ?? "";
	const value = draft ?? saved;
	const dirty = draft != null && draft !== saved;
	const shortcut =
		typeof navigator === "undefined"
			? "Ctrl+S"
			: fileEditorSaveShortcut(navigator.platform);
	const save = useMutation({
		mutationFn: async () => {
			if (!path || !dirty) return { ok: true as const, path };
			return writeSource({
				data: { projectId, sessionId, path, text: value },
			});
		},
		onSuccess: async (result) => {
			if (!path || !result.ok) return;
			onDraftChange(path, value, value);
			await queryClient.invalidateQueries({
				queryKey: ["workspace-source", projectId, sessionId, path],
			});
			await queryClient.invalidateQueries({
				queryKey: ["workspace-explorer", projectId, sessionId],
			});
		},
	});
	useEffect(() => {
		if (!dirty) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [dirty]);
	if (!path) {
		return (
			<div className="file-editor">
				<p className="diff-preview-empty">Select a file to open it.</p>
			</div>
		);
	}
	if (previewKind === "image")
		return (
			<section className="file-editor" aria-label={path}>
				<header className="file-editor-tab">
					<FileTypeIcon path={path} />
					<span>{fileBasename(path)}</span>
				</header>
				<div className="file-editor-pane">
					<WorkspaceImagePreview
						path={path}
						projectId={projectId}
						sessionId={sessionId}
					/>
				</div>
			</section>
		);
	if (pending && text == null) {
		return (
			<section className="file-editor" aria-label={path}>
				<p className="diff-preview-empty">Opening {fileBasename(path)}…</p>
			</section>
		);
	}
	if (text == null) {
		return (
			<section className="file-editor" aria-label={path}>
				<p className="diff-preview-empty">
					Could not open {fileBasename(path)}. The file or workspace may be
					unavailable.
				</p>
				<button type="button" className="file-editor-save" onClick={onRetry}>
					Try again
				</button>
			</section>
		);
	}
	const saveFailed =
		save.data && !save.data.ok
			? save.data.reason === "asleep"
				? "Wake the workspace to save."
				: "Could not save."
			: null;
	return (
		<section
			className="file-editor"
			aria-label={path}
			data-dirty={dirty || undefined}
		>
			<header className="file-editor-tab">
				<FileTypeIcon path={path} />
				<span>{fileBasename(path)}</span>
				{previewKind !== "code" ? (
					<PreviewModeSwitch mode={mode} onChange={setMode} />
				) : null}
				{dirty ? <span className="file-editor-dirty" aria-hidden /> : null}
				{dirty || save.isPending ? (
					<button
						type="button"
						className="file-editor-save"
						disabled={save.isPending || !dirty}
						onClick={() => save.mutate()}
					>
						{save.isPending ? "Saving…" : `Save ${shortcut}`}
					</button>
				) : null}
			</header>
			{saveFailed ? <p className="file-editor-error">{saveFailed}</p> : null}
			<div className="file-editor-pane">
				{mode === "preview" ? (
					<FilePreview path={path} content={{ kind: "text", text: value }} />
				) : (
					<Suspense fallback={<pre>{value}</pre>}>
						<SourceEditor
							path={path}
							value={value}
							onChange={(next) => onDraftChange(path, next, saved)}
							onSave={() => {
								if (dirty && !save.isPending) save.mutate();
							}}
						/>
					</Suspense>
				)}
			</div>
		</section>
	);
}

function FileTreeFile({
	node,
	depth,
	selected,
	onSelectPath,
}: {
	node: Extract<WorkspaceTreeNode, { kind: "file" }>;
	depth: number;
	selected: boolean;
	onSelectPath: (path: string) => void;
}) {
	const mark = fileTreeChangeMark(node.change?.change);
	return (
		<button
			type="button"
			className="file-tree-file"
			data-selected={selected}
			data-change={node.change?.change}
			style={{ paddingLeft: 8 + depth * 12 }}
			onClick={() => onSelectPath(node.path)}
		>
			<FileTypeIcon path={node.path} />
			<span className="file-tree-name">{node.name}</span>
			{mark ? <span className="file-tree-mark">{mark}</span> : null}
		</button>
	);
}

function FileTreeNodes({
	nodes,
	depth,
	selectedPath,
	onSelectPath,
}: {
	nodes: readonly WorkspaceTreeNode[];
	depth: number;
	selectedPath?: string;
	onSelectPath: (path: string) => void;
}) {
	return (
		<ul className="file-tree-list">
			{nodes.map((node) => (
				<li key={node.path}>
					{node.kind === "dir" ? (
						<details className="file-tree-dir" open>
							<summary style={{ paddingLeft: 8 + depth * 12 }}>
								<ChevronRight size={12} className="session-activity-chevron" />
								<span className="file-tree-name">{node.name}</span>
							</summary>
							<FileTreeNodes
								nodes={node.children}
								depth={depth + 1}
								selectedPath={selectedPath}
								onSelectPath={onSelectPath}
							/>
						</details>
					) : (
						<FileTreeFile
							node={node}
							depth={depth}
							selected={node.path === selectedPath}
							onSelectPath={onSelectPath}
						/>
					)}
				</li>
			))}
		</ul>
	);
}
