import type { AgentProviderId } from "#/domain/agent-provider";

const storageKey = "ytimesy:model-favorites";

export function favoriteModelKey(
	provider: AgentProviderId,
	modelId: string,
): string {
	return JSON.stringify([provider, modelId]);
}

export function readModelFavorites(): readonly string[] {
	try {
		const value: unknown = JSON.parse(
			window.localStorage.getItem(storageKey) ?? "[]",
		);
		return Array.isArray(value)
			? value.filter((entry): entry is string => typeof entry === "string")
			: [];
	} catch {
		return [];
	}
}

export function writeModelFavorites(favorites: readonly string[]): void {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(favorites));
	} catch {
		/* Favorites remain usable in memory when browser storage is unavailable. */
	}
}
