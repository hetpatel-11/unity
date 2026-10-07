import { fileChangeTotals } from "./diff-preview";
import { fileBasename } from "./file-kind";
import type { FileChangeEntry } from "./session-item";
import { visibleWorkspacePath } from "./visible-workspace-path";

export function fileChangeActivity(changes: readonly FileChangeEntry[]): {
	readonly verb: "Created" | "Deleted" | "Edited";
	readonly name: string | null;
} {
	if (changes.length === 1) {
		const change = changes[0];
		if (change) {
			const verb =
				change.change === "add"
					? "Created"
					: change.change === "delete"
						? "Deleted"
						: "Edited";
			return { verb, name: fileBasename(change.path) };
		}
	}
	return { verb: "Edited", name: null };
}

export function fileChangeActivityTitle(
	changes: readonly FileChangeEntry[],
): string {
	const activity = fileChangeActivity(changes);
	if (activity.name) return `${activity.verb} ${activity.name}`;
	return `${activity.verb} ${changes.length} files`;
}

export function filesChangedLabel(count: number): string {
	return count === 1 ? "1 file changed" : `${count} files changed`;
}

export function fileChangeDisplayPath(path: string): string {
	return visibleWorkspacePath(path);
}

export function fileChangesHeading(changes: readonly FileChangeEntry[]): {
	readonly label: string;
	readonly additions: number;
	readonly deletions: number;
} {
	const totals = fileChangeTotals(changes);
	return {
		label: filesChangedLabel(changes.length),
		additions: totals.additions,
		deletions: totals.deletions,
	};
}
