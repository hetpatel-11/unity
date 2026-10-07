export type AgentTodo = {
	readonly text: string;
	readonly status: "pending" | "in_progress" | "completed";
};

/** Both adapters supply full checklist snapshots, not toggle events. */
export function agentTodosFromUnknown(value: unknown): AgentTodo[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") return [];
		const text = entry.step ?? entry.content ?? entry.text;
		const status = entry.status;
		if (
			typeof text !== "string" ||
			!text.trim() ||
			!["pending", "in_progress", "completed"].includes(status)
		)
			return [];
		return [{ text: text.trim(), status }];
	});
}
