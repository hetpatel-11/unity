export type SessionActivityGlyph =
	| "thinking"
	| "plan"
	| "shell"
	| "search"
	| "read"
	| "edit"
	| "files"
	| "web"
	| "mcp"
	| "error"
	| "tool";

const SEARCH_TOOLS = new Set([
	"grep",
	"rg",
	"glob",
	"search",
	"codebase_search",
	"semantic_search",
	"search_code",
]);

const READ_TOOLS = new Set(["read_file", "read", "cat", "view", "open"]);

const EDIT_TOOLS = new Set([
	"apply_patch",
	"write_file",
	"write",
	"edit",
	"str_replace",
	"search_replace",
	"create_file",
	"delete_file",
]);

const SHELL_TOOLS = new Set(["shell", "bash", "zsh", "command", "exec"]);

const WEB_TOOLS = new Set(["web_search", "web_fetch", "websearch", "fetch"]);

function toolKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, "_");
}

export function activityGlyphForToolName(tool: string): SessionActivityGlyph {
	const key = toolKey(tool);
	if (WEB_TOOLS.has(key) || key.startsWith("web_")) return "web";
	if (EDIT_TOOLS.has(key)) return "edit";
	if (READ_TOOLS.has(key) || key.startsWith("read")) return "read";
	if (SHELL_TOOLS.has(key)) return "shell";
	if (SEARCH_TOOLS.has(key)) return "search";
	if (key.includes("web")) return "web";
	if (key.includes("patch") || key.includes("write") || key.includes("edit")) {
		return "edit";
	}
	if (key.includes("shell") || key.includes("command")) return "shell";
	if (key.includes("grep") || key.includes("search")) return "search";
	return "tool";
}

export function activityTitleForToolName(tool: string): string {
	const glyph = activityGlyphForToolName(tool);
	if (glyph === "search") return tool || "Search";
	if (glyph === "read") return tool || "Read";
	if (glyph === "edit") return tool || "Edit";
	if (glyph === "shell") return tool || "Shell";
	if (glyph === "web") return tool || "Search";
	return tool || "Tool";
}
