import type { ModelProvider } from "./model-connection";

export type BrowseModel = {
	id: string;
	label: string;
	author: string;
	created: number;
	contextWindow?: number;
};
export const AUTHOR_LABELS: Record<string, string> = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	"x-ai": "xAI",
	google: "Google",
	meta: "Meta",
	moonshotai: "Moonshot AI",
	deepseek: "DeepSeek",
	qwen: "Qwen",
	mistralai: "Mistral",
	"z-ai": "Z.ai",
	tencent: "Tencent",
};
const MAX_MODEL_AGE_SECONDS = 365 * 24 * 60 * 60;
const RETAINED_MODEL_GENERATIONS = 3;

function modelGeneration(id: string) {
	const canonical = id.replace(/:.*$/, "");
	const version = canonical.match(/\d+(?:[.-]\d{1,2}(?!\d))?/);
	if (!version || Number(version[0].split(/[.-]/)[0]) >= 2000) return null;
	const family = canonical.slice(0, version.index).replace(/[-.]$/, "");
	const claudeTier = canonical.match(
		/(?:^|[-/])(opus|sonnet|haiku)(?:-|$)/,
	)?.[1];
	return {
		family: claudeTier ? `anthropic/claude-${claudeTier}` : family,
		version: version[0].replace("-", "."),
	};
}

/** Keep release generations, not three individual variants or recently republished aliases. */
export function recentModelGenerations<T extends { id: string }>(
	models: readonly T[],
): T[] {
	const generations = new Map<string, Set<string>>();
	for (const model of models) {
		const release = modelGeneration(model.id);
		if (!release) continue;
		const versions = generations.get(release.family) ?? new Set<string>();
		versions.add(release.version);
		generations.set(release.family, versions);
	}
	const retained = new Map(
		[...generations].map(([family, versions]) => [
			family,
			[...versions]
				.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
				.slice(0, RETAINED_MODEL_GENERATIONS),
		]),
	);
	return models.filter((model) => {
		const release = modelGeneration(model.id);
		return !release || retained.get(release.family)?.includes(release.version);
	});
}
const OFFERED_GOOGLE_MODELS: readonly string[] = [
	"gemini-3.8-flash",
	"gemini-3.7-flash",
	"gemini-3.6-flash",
];

export function googleFlashModelRank(id: string): number {
	return OFFERED_GOOGLE_MODELS.indexOf(id.replace(/^google\//, ""));
}

export function isShownInModelPicker(author: string, id: string): boolean {
	if (author !== "google") return true;
	return googleFlashModelRank(id) !== -1;
}

export function matchesModelSearch(
	model: Pick<BrowseModel, "label" | "author">,
	search: string,
): boolean {
	const term = search.trim().toLowerCase();
	return (
		!term ||
		model.label.toLowerCase().includes(term) ||
		model.author.toLowerCase().includes(term) ||
		(AUTHOR_LABELS[model.author] ?? "").toLowerCase().includes(term)
	);
}
export function visibleModelChoices<
	T extends Pick<BrowseModel, "label" | "author">,
>(models: readonly T[], search: string): T[] {
	const matching = models.filter((model) => matchesModelSearch(model, search));
	return matching;
}
export const DIRECT_MODEL_ENDPOINTS: Record<string, string> = {
	meta: "https://api.meta.ai/v1",
	deepseek: "https://api.deepseek.com",
	"x-ai": "https://api.x.ai/v1",
	mistralai: "https://api.mistral.ai/v1",
};
export function directModelProvider(author: string): ModelProvider | null {
	if (Object.hasOwn(DIRECT_MODEL_ENDPOINTS, author)) return "compatible";
	return author === "openai" || author === "anthropic" || author === "google"
		? author
		: null;
}
export function openRouterModelLabel(name: string): string {
	return name.replace(/^[^:]+: /, "");
}
export function isNonCodingModelId(id: string): boolean {
	return /(?:audio|embedding|image|realtime|search|transcri|tts|safeguard|guard|moderation|classifier|rerank|voxtral|omni)/i.test(
		id,
	);
}
export function isOpenRouterCodingModel(row: unknown): row is {
	id: string;
	name: string;
	created?: number;
	context_length?: number;
} {
	if (!row || typeof row !== "object") return false;
	const model = row as Record<string, unknown>;
	const architecture = model.architecture as
		| { output_modalities?: unknown }
		| undefined;
	return (
		typeof model.id === "string" &&
		typeof model.name === "string" &&
		model.id.length <= 512 &&
		!model.id.endsWith(":batch") &&
		!model.id.startsWith("~") &&
		!isNonCodingModelId(model.id) &&
		Array.isArray(model.supported_parameters) &&
		model.supported_parameters.includes("tools") &&
		Array.isArray(architecture?.output_modalities) &&
		architecture.output_modalities.length === 1 &&
		architecture.output_modalities[0] === "text"
	);
}
export function parseBrowseModels(
	value: unknown,
	nowSeconds = Math.floor(Date.now() / 1000),
): BrowseModel[] {
	const rows = (value as { data?: unknown })?.data;
	if (!Array.isArray(rows)) throw new Error("Model catalog unavailable.");
	const models = new Map<string, BrowseModel>();
	for (const row of rows) {
		if (!isOpenRouterCodingModel(row)) continue;
		const created = typeof row.created === "number" ? row.created : 0;
		if (
			created < nowSeconds - MAX_MODEL_AGE_SECONDS &&
			!modelGeneration(row.id)
		)
			continue;
		const author = row.id.split("/")[0];
		if (!Object.hasOwn(AUTHOR_LABELS, author)) continue;
		if (/^tencent\/hy4(?:[-:]|$)/i.test(row.id)) continue;
		if (!isShownInModelPicker(author, row.id)) continue;
		models.set(row.id, {
			id: row.id,
			label: openRouterModelLabel(row.name).slice(0, 160),
			author,
			created,
			...(typeof row.context_length === "number" &&
			Number.isSafeInteger(row.context_length) &&
			row.context_length > 0
				? { contextWindow: row.context_length }
				: {}),
		});
	}
	return recentModelGenerations([...models.values()]).sort(
		(a, b) => b.created - a.created,
	);
}
