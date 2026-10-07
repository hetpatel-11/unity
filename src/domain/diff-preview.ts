import { parsePatch } from "diff";
import { isUnifiedDiff } from "./diff-stats";
import type { FileChangeEntry } from "./session-item";

export type DiffPreviewLine = {
	readonly kind: "add" | "del" | "ctx";
	readonly text: string;
	readonly oldNumber: number | null;
	readonly newNumber: number | null;
};
const PREVIEW_LINE_LIMIT = 400;
export type DiffPreviewHunk = {
	readonly oldStart: number;
	readonly newStart: number;
	readonly lines: readonly DiffPreviewLine[];
};
export function diffPreviewHunks(
	change: FileChangeEntry,
): readonly DiffPreviewHunk[] {
	const preview = change.preview;
	if (!preview) return [];
	if (!isUnifiedDiff(preview)) {
		const lines = preview.split("\n");
		if (lines.at(-1) === "") lines.pop();
		return [
			{
				oldStart: change.change === "delete" ? 1 : 0,
				newStart: change.change === "delete" ? 0 : 1,
				lines: lines.slice(0, PREVIEW_LINE_LIMIT).map((text, index) => ({
					kind: change.change === "delete" ? "del" : "add",
					text,
					oldNumber: change.change === "delete" ? index + 1 : null,
					newNumber: change.change === "delete" ? null : index + 1,
				})),
			},
		];
	}
	const hunks: DiffPreviewHunk[] = [];
	let lineCount = 0;
	try {
		for (const file of parsePatch(preview)) {
			for (const hunk of file.hunks) {
				if (lineCount >= PREVIEW_LINE_LIMIT) return hunks;
				const lines: DiffPreviewLine[] = [];
				hunks.push({ oldStart: hunk.oldStart, newStart: hunk.newStart, lines });
				let oldNumber = hunk.oldStart;
				let newNumber = hunk.newStart;
				for (const line of hunk.lines) {
					if (lineCount >= PREVIEW_LINE_LIMIT) return hunks;
					const prefix = line[0];
					if (prefix !== "+" && prefix !== "-" && prefix !== " ") continue;
					lineCount++;
					lines.push({
						kind: prefix === "+" ? "add" : prefix === "-" ? "del" : "ctx",
						text: line.slice(1),
						oldNumber: prefix === "+" ? null : oldNumber++,
						newNumber: prefix === "-" ? null : newNumber++,
					});
				}
			}
		}
	} catch {
		// Truncated provider output is not a valid patch; never invent line numbers.
		return [];
	}
	return hunks;
}
export function fileChangeTotals(changes: readonly FileChangeEntry[]) {
	return changes.reduce(
		(totals, change) => ({
			additions: totals.additions + change.additions,
			deletions: totals.deletions + change.deletions,
		}),
		{ additions: 0, deletions: 0 },
	);
}
