import { activityGlyphForToolName } from "./session-activity";
import {
	liveActivityStatus,
	type SessionItem,
	type SessionTurnStatus,
} from "./session-item";
import { workedLabel } from "./turn-timing";

export type ExplorationCounts = {
	readonly files: number;
	readonly searches: number;
};

export type TimelineRow =
	| { readonly kind: "item"; readonly item: SessionItem }
	| {
			readonly kind: "work";
			readonly label: string;
			readonly id: SessionItem["id"];
			readonly items: readonly SessionItem[];
	  }
	| {
			readonly kind: "exploration";
			readonly id: SessionItem["id"];
			readonly counts: ExplorationCounts;
			readonly items: readonly SessionItem[];
	  };

export function isExplorationItem(item: SessionItem): boolean {
	if (item.kind === "fileChange") return false;
	if (item.kind === "webSearch") return true;
	if (item.kind === "dynamicToolCall") {
		return isExplorationGlyph(activityGlyphForToolName(item.tool));
	}
	if (item.kind === "unknown") {
		return isExplorationGlyph(activityGlyphForToolName(item.type));
	}
	return false;
}

export function explorationCounts(
	items: readonly SessionItem[],
): ExplorationCounts {
	let files = 0;
	let searches = 0;
	for (const item of items) {
		if (item.kind === "webSearch") {
			searches += 1;
			continue;
		}
		const name =
			item.kind === "dynamicToolCall"
				? item.tool
				: item.kind === "unknown"
					? item.type
					: "";
		if (isExplorationGlyph(activityGlyphForToolName(name))) {
			if (activityGlyphForToolName(name) === "read") files += 1;
			else searches += 1;
		}
	}
	return { files, searches };
}

export function explorationLabel(counts: ExplorationCounts): string {
	const parts: string[] = [];
	if (counts.files > 0) {
		parts.push(counts.files === 1 ? "1 file" : `${counts.files} files`);
	}
	if (counts.searches > 0) {
		parts.push(
			counts.searches === 1 ? "1 search" : `${counts.searches} searches`,
		);
	}
	if (parts.length === 0) return "Explored";
	return `Explored ${parts.join(" ")}`;
}

export function explorationGroupIsLive(items: readonly SessionItem[]): boolean {
	return items.some((item) => liveActivityStatus(item) === "inProgress");
}

export function groupTimelineRows(
	items: readonly SessionItem[],
	turnStatus: SessionTurnStatus = "running",
): TimelineRow[] {
	const rows: TimelineRow[] = [];
	let turn: SessionItem[] = [];
	let timing: { startedAt: number; completedAt?: number } | undefined;
	function flush(completed: boolean) {
		const visible = turn.filter(
			(item) =>
				item.kind !== "reasoning" ||
				item.summaries.some((summary) => summary.trim()),
		);
		if (!completed) {
			rows.push(...groupExplorationRows(turn));
			return;
		}
		const final = visible
			.filter(
				(item) => item.kind === "agentMessage" && item.phase !== "commentary",
			)
			.at(-1);
		const activity = visible.filter(
			(item) =>
				item !== final && item.kind !== "fileChange" && item.kind !== "error",
		);
		if (activity[0])
			rows.push({
				kind: "work",
				id: activity[0].id,
				items: activity,
				label: workedLabel(timing),
			});
		if (final) rows.push({ kind: "item", item: final });
		rows.push(
			...visible
				.filter((item) => item.kind === "fileChange" || item.kind === "error")
				.map((item) => ({ kind: "item" as const, item })),
		);
	}
	for (const item of items) {
		if (item.kind === "userMessage") {
			flush(true);
			turn = [];
			timing = item.timing;
			rows.push({ kind: "item", item });
		} else turn.push(item);
	}
	flush(turnStatus !== "running");
	return rows;
}

export function groupExplorationRows(
	items: readonly SessionItem[],
): TimelineRow[] {
	const rows: TimelineRow[] = [];
	let index = 0;
	while (index < items.length) {
		const item = items[index];
		if (!item) break;
		if (!isExplorationItem(item)) {
			rows.push({ kind: "item", item });
			index += 1;
			continue;
		}
		const grouped: SessionItem[] = [];
		while (index < items.length) {
			const next = items[index];
			if (!next || !isExplorationItem(next)) {
				break;
			}
			grouped.push(next);
			index += 1;
		}
		const first = grouped[0];
		if (!first) continue;
		rows.push({
			kind: "exploration",
			id: first.id,
			counts: explorationCounts(grouped),
			items: grouped,
		});
	}
	return rows;
}

function isExplorationGlyph(glyph: string): boolean {
	return glyph === "search" || glyph === "read" || glyph === "web";
}
