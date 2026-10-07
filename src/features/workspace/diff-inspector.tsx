import { ChevronDown } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { diffPreviewHunks } from "#/domain/diff-preview";
import {
	fileChangeDisplayPath,
	fileChangesHeading,
} from "#/domain/file-change-copy";
import { filePreviewKind } from "#/domain/file-preview";
import type { FileChangeEntry } from "#/domain/session-item";
import { sourceLanguageFromPath } from "#/domain/source-language";
import { fileChangeForPath } from "#/domain/workspace-file-tree";
import { FileChangeCounts } from "../sessions/file-change-counts";
import { DiffHunkPreview } from "./diff-hunk-preview";
import { PreviewModeSwitch, WorkspaceDiffPreview } from "./file-preview";

export function DiffInspector({
	changes,
	selectedPath,
	projectId,
	sessionId,
}: {
	changes: readonly FileChangeEntry[];
	selectedPath?: string;
	projectId?: string;
	sessionId?: string;
}) {
	const heading = fileChangesHeading(changes);
	return (
		<section className="diff-inspector" aria-label="Code changes">
			<header className="diff-inspector-header">
				<span>{heading.label}</span>
				<FileChangeCounts
					additions={heading.additions}
					deletions={heading.deletions}
				/>
			</header>
			<ul className="diff-file-list">
				{changes.map((change, index) => (
					<li key={`${change.change}:${change.path}`}>
						<DiffFilePreview
							projectId={projectId}
							sessionId={sessionId}
							change={change}
							defaultOpen={index === 0 && !selectedPath}
							selected={
								fileChangeForPath(
									selectedPath ? [change] : [],
									selectedPath ?? "",
								) != null
							}
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

export function DiffFilePreview({
	change,
	defaultOpen,
	selected = false,
	projectId,
	sessionId,
}: {
	change: FileChangeEntry;
	defaultOpen: boolean;
	selected?: boolean;
	projectId?: string;
	sessionId?: string;
}) {
	const path = fileChangeDisplayPath(change.path);
	const slash = path.lastIndexOf("/");
	const filename = path.slice(slash + 1);
	const directory = slash >= 0 ? path.slice(0, slash + 1) : "";
	const language = sourceLanguageFromPath(change.path);
	const hunks = diffPreviewHunks(change);
	const [open, setOpen] = useState(defaultOpen || selected);
	const [mode, setMode] = useState<"preview" | "code">("code");
	const previewable = filePreviewKind(change.path) !== "code";
	useEffect(() => {
		if (selected) setOpen(true);
	}, [selected]);
	return (
		<details
			className="diff-file"
			data-selected={selected ? "true" : undefined}
			open={open}
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary title={change.path}>
				<ChevronDown
					className="diff-file-chevron"
					size={14}
					aria-hidden="true"
				/>
				<span className="diff-file-label">
					<span className="file-change-name">{filename}</span>
					<span className="diff-file-directory">{directory}</span>
				</span>
				<span className="diff-file-meta">
					<FileChangeCounts
						additions={change.additions}
						deletions={change.deletions}
					/>
					{change.change === "add" ? (
						<span className="diff-file-badge">New</span>
					) : null}
				</span>
			</summary>
			{previewable ? (
				<div className="diff-preview-controls">
					<PreviewModeSwitch mode={mode} onChange={setMode} />
				</div>
			) : null}
			{mode === "preview" && open ? (
				<WorkspaceDiffPreview
					path={change.path}
					projectId={projectId}
					sessionId={sessionId}
				/>
			) : hunks.length === 0 ? (
				change.preview ? (
					<>
						<p className="diff-preview-empty">
							Source line numbers unavailable for this preview.
						</p>
						<pre className="diff-preview">{change.preview}</pre>
					</>
				) : (
					<p className="diff-preview-empty">No diff preview for this file.</p>
				)
			) : (
				<div className="diff-preview">
					{hunks.map((hunk, index) => {
						const previous = hunks[index - 1];
						const skipped = previous
							? hunk.newStart -
								previous.newStart -
								previous.lines.filter((line) => line.newNumber !== null).length
							: 0;
						return (
							<Fragment key={`${hunk.oldStart}:${hunk.newStart}`}>
								{skipped > 0 ? (
									<div className="diff-context-gap">
										<span>
											{skipped} unmodified {skipped === 1 ? "line" : "lines"}
										</span>
									</div>
								) : null}
								<DiffHunkPreview preview={hunk} language={language} />
							</Fragment>
						);
					})}
				</div>
			)}
		</details>
	);
}
