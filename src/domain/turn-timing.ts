import type { SessionItem, SessionTurnStatus } from "./session-item";

/** Measures dispatch-to-observed-completion, including waiting for the runtime. */
export function recordTurnTiming(
	items: readonly SessionItem[],
	status: SessionTurnStatus,
	now: number,
	start = false,
): SessionItem[] {
	const user = items.filter((item) => item.kind === "userMessage").at(-1);
	return items.map((item) => {
		if (item !== user || item.kind !== "userMessage") return item;
		if (start) return { ...item, timing: { startedAt: now } };
		if (
			!item.timing ||
			item.timing.completedAt !== undefined ||
			(status !== "completed" && status !== "failed")
		)
			return item;
		return {
			...item,
			timing: {
				...item.timing,
				completedAt: Math.max(now, item.timing.startedAt),
			},
		};
	});
}

export function workedLabel(
	timing: { startedAt: number; completedAt?: number } | undefined,
): string {
	if (!timing || timing.completedAt === undefined) return "Worked";
	const seconds = Math.round((timing.completedAt - timing.startedAt) / 1000);
	if (!Number.isFinite(seconds) || seconds <= 0) return "Worked";
	return seconds < 60
		? `Worked for ${seconds}s`
		: `Worked for ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}
