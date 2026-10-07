export function thoughtLabel(input: {
	readonly durationSeconds?: number | null;
	readonly inProgress?: boolean;
}): string {
	if (input.inProgress) return "Thinking";
	const seconds = input.durationSeconds;
	if (seconds != null && seconds > 0) {
		const rounded = Math.max(1, Math.round(seconds));
		return rounded === 1
			? "Thought for 1 second"
			: `Thought for ${rounded} seconds`;
	}
	return "Thought";
}
