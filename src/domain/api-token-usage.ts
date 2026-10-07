export type ApiTokenUsage = {
	inputTokens: number | null;
	outputTokens: number | null;
	uncachedInputTokens: number | null;
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
};

export function addApiTokenUsage(
	previous: ApiTokenUsage | null,
	next: ApiTokenUsage,
): ApiTokenUsage {
	if (!previous) return next;
	return Object.fromEntries(
		Object.keys(next).map((field) => {
			const key = field as keyof ApiTokenUsage;
			return [
				key,
				previous[key] === null || next[key] === null
					? null
					: previous[key] + next[key],
			];
		}),
	) as ApiTokenUsage;
}
