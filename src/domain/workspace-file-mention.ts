export function workspaceFileMention(value: string): string | null {
	const path = value.trim();
	if (!path || /\s/.test(path) || path.includes("*") || path.startsWith("//"))
		return null;
	if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("#")) return null;
	return path.includes("/") || /\.[A-Za-z0-9]{1,12}(?::\d+)?$/.test(path)
		? path
		: null;
}
