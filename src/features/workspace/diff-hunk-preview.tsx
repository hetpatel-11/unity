import {
	type ChangeData,
	Diff,
	Hunk,
	type HunkData,
	type HunkTokens,
} from "react-diff-view";
import type { DiffPreviewHunk } from "#/domain/diff-preview";
import type { SourceLanguage } from "#/domain/source-language";
import {
	HighlightedTokens,
	useHighlightedLines,
} from "../sessions/highlighted-code";

export function diffViewHunk(preview: DiffPreviewHunk): HunkData {
	const changes = preview.lines.map((line): ChangeData => {
		if (line.oldNumber === null)
			return {
				type: "insert",
				isInsert: true,
				lineNumber: line.newNumber ?? 0,
				content: line.text,
			};
		if (line.newNumber === null)
			return {
				type: "delete",
				isDelete: true,
				lineNumber: line.oldNumber,
				content: line.text,
			};
		return {
			type: "normal",
			isNormal: true,
			oldLineNumber: line.oldNumber,
			newLineNumber: line.newNumber,
			content: line.text,
		};
	});
	const oldLines = changes.filter((line) => line.type !== "insert").length;
	const newLines = changes.filter((line) => line.type !== "delete").length;
	return {
		oldStart: preview.oldStart,
		newStart: preview.newStart,
		oldLines,
		newLines,
		changes,
		content: `@@ -${preview.oldStart},${oldLines} +${preview.newStart},${newLines} @@`,
	};
}

export function DiffHunkPreview({
	preview,
	language,
}: {
	preview: DiffPreviewHunk;
	language: SourceLanguage;
}) {
	const hunk = diffViewHunk(preview);
	const oldLines = preview.lines.filter((line) => line.oldNumber !== null);
	const newLines = preview.lines.filter((line) => line.newNumber !== null);
	const oldHighlight = useHighlightedLines(
		oldLines.map((line) => line.text).join("\n"),
		language,
	);
	const newHighlight = useHighlightedLines(
		newLines.map((line) => line.text).join("\n"),
		language,
	);
	const tokens: HunkTokens = { old: [], new: [] };
	oldLines.forEach((line, index) => {
		tokens.old[(line.oldNumber ?? 1) - 1] = [
			{ type: "shiki", value: line.text, highlighted: oldHighlight?.[index] },
		];
	});
	newLines.forEach((line, index) => {
		tokens.new[(line.newNumber ?? 1) - 1] = [
			{ type: "shiki", value: line.text, highlighted: newHighlight?.[index] },
		];
	});
	return (
		<Diff
			viewType="unified"
			diffType="modify"
			hunks={[hunk]}
			tokens={tokens}
			renderGutter={({ change, side }) =>
				side === "old"
					? null
					: change.type === "normal"
						? change.newLineNumber
						: change.lineNumber
			}
			renderToken={(token, renderDefault, index) =>
				token.type === "shiki" ? (
					<HighlightedTokens
						key={index}
						text={token.value}
						tokens={token.highlighted}
					/>
				) : (
					renderDefault(token, index)
				)
			}
		>
			{(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
		</Diff>
	);
}
