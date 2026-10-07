import type { FileChangeEntry } from "#/domain/session-item";
import { fileChangeForPath } from "#/domain/workspace-file-tree";
import { FileTypeIcon } from "./file-type-icon";

export function FileMentionButton({
	path,
	name,
	change,
	onOpenFile,
}: {
	path: string;
	name: string;
	change?: FileChangeEntry["change"];
	onOpenFile?: (path: string) => void;
}) {
	const chip = (
		<span className="session-file-chip">
			<FileTypeIcon path={path} />
			<span className="session-file-name" data-change={change}>
				{name}
			</span>
		</span>
	);
	if (!onOpenFile) return chip;
	return (
		<button
			type="button"
			className="session-file-open"
			title={`Open ${path}`}
			onClick={() => onOpenFile(path)}
		>
			{chip}
		</button>
	);
}

export function mentionedFileChange(
	path: string,
	changes: readonly FileChangeEntry[],
) {
	return fileChangeForPath(changes, path);
}
