export const INSPECTOR_SPLIT_MIN = 0.32;
export const INSPECTOR_SPLIT_MAX = 0.72;
export const INSPECTOR_SPLIT_DEFAULT = 0.42;
export const CHAT_PANE_MIN_WIDTH = 320;
export const INSPECTOR_PANE_MIN_WIDTH = 360;
export function workspaceNeedsSinglePane(width: number): boolean {
	return width < CHAT_PANE_MIN_WIDTH + INSPECTOR_PANE_MIN_WIDTH + 4;
}
export const INSPECTOR_SPLIT_DESKTOP = 0.38;

export function clampInspectorSplit(ratio: number): number {
	if (!Number.isFinite(ratio)) return INSPECTOR_SPLIT_DEFAULT;
	return Math.min(INSPECTOR_SPLIT_MAX, Math.max(INSPECTOR_SPLIT_MIN, ratio));
}

export function inspectorPaneIsWide(view: string): boolean {
	return view === "desktop" || view === "files";
}

export function inspectorSplitRatio(input: {
	readonly custom: number | null;
	readonly wide: boolean;
}): number {
	if (input.custom !== null) return clampInspectorSplit(input.custom);
	return input.wide ? INSPECTOR_SPLIT_DESKTOP : INSPECTOR_SPLIT_DEFAULT;
}
