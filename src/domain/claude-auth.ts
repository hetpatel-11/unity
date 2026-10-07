import { claudeStreamTerminalResult } from "./claude-stream";
import type { ListedReasoning } from "./listed-model";

const ANTHROPIC_LOGIN_HOSTS = new Set([
	"claude.ai",
	"claude.com",
	"platform.claude.com",
	"console.anthropic.com",
]);

const LOGIN_URL_PATTERN =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Terminal control bytes must not become part of an authorization URL.
	/https:\/\/(?:claude\.ai|claude\.com|platform\.claude\.com|console\.anthropic\.com)[^\s"'<>\\\x00-\x1f]+/gi;

export function parseClaudeBinaryPath(output: string): string | null {
	return output.match(/^CLAUDE_BIN=(.+)$/m)?.[1]?.trim() || null;
}

export function parseClaudeHomePath(output: string): string | null {
	return output.match(/^CLAUDE_HOME=(.+)$/m)?.[1]?.trim() || null;
}

export function parseAnthropicLoginUrl(output: string): string | null {
	const matches = output.match(LOGIN_URL_PATTERN) ?? [];
	for (const raw of matches) {
		const url = stripTrailingPunctuation(raw);
		if (isAnthropicAuthorizeUrl(url)) return url;
	}
	return null;
}

export function isAnthropicAuthorizeUrl(value: string): boolean {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return false;
		if (!ANTHROPIC_LOGIN_HOSTS.has(url.hostname)) return false;
		return url.pathname.includes("oauth") || url.pathname.includes("login");
	} catch {
		return false;
	}
}

const CALLBACK_CODE_PATTERN =
	/^[A-Za-z0-9._~+/-]+=*(?:#[A-Za-z0-9._~+/-]+=*)+$/;
const LONG_CODE_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/;

/**
 * Anthropic's remote login is not device-code. After the user signs in on
 * Anthropic's page, that page shows a paste-back code bound to the same
 * `claude auth login` PKCE session. API keys and setup-tokens are not this
 * code.
 */
export function parseClaudeAuthPasteCode(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed || /\s/.test(trimmed)) return null;
	if (isAnthropicApiKey(trimmed) || isClaudeOauthToken(trimmed)) return null;
	const fromUrl = codeFromAnthropicCallbackUrl(trimmed);
	if (fromUrl) return fromUrl;
	if (trimmed.length < 8 || trimmed.length > 2048) return null;
	if (CALLBACK_CODE_PATTERN.test(trimmed)) return trimmed;
	if (LONG_CODE_PATTERN.test(trimmed) && trimmed.length >= 16) return trimmed;
	return null;
}

export function isAnthropicApiKey(value: string): boolean {
	return /^sk-ant-api/i.test(value.trim());
}

export function isClaudeOauthToken(value: string): boolean {
	return /^sk-ant-oat/i.test(value.trim());
}

function codeFromAnthropicCallbackUrl(value: string): string | null {
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return null;
		if (!ANTHROPIC_LOGIN_HOSTS.has(url.hostname)) return null;
		if (!url.pathname.includes("callback") && !url.pathname.includes("code")) {
			return null;
		}
		const code = url.searchParams.get("code")?.trim();
		if (!code) return null;
		const state = url.searchParams.get("state")?.trim();
		return state ? `${code}#${state}` : code;
	} catch {
		return null;
	}
}

export function claudeSessionRemembersSignIn(
	listedModelId?: string | null,
): boolean {
	const id = listedModelId?.trim() ?? "";
	if (!id) return false;
	return (
		id === "fable" ||
		id === "opus" ||
		id === "sonnet" ||
		id.startsWith("claude")
	);
}

export function rememberedClaudeModels(listedModelId: string): readonly {
	readonly id: string;
	readonly label: string;
}[] {
	const aliases = [
		{ id: "fable", label: "fable" },
		{ id: "opus", label: "opus" },
		{ id: "sonnet", label: "sonnet" },
	] as const;
	if (aliases.some((model) => model.id === listedModelId)) return aliases;
	return [{ id: listedModelId, label: listedModelId }, ...aliases];
}

export function claudeCliIsSignedIn(output: string): boolean {
	const text = output.trim();
	if (!text) return false;
	if (/\bnot logged in\b/i.test(text)) return false;
	if (/\blogin required\b/i.test(text)) return false;
	const fromJson = loggedInFromStatusJson(text);
	if (fromJson !== null) return fromJson;
	return (
		/\blogged in\b/i.test(text) ||
		/\blogin successful\b/i.test(text) ||
		/\bauthenticated\b/i.test(text)
	);
}

function loggedInFromStatusJson(output: string): boolean | null {
	try {
		const parsed: unknown = JSON.parse(output);
		if (!isRecord(parsed) || typeof parsed.loggedIn !== "boolean") {
			return null;
		}
		return parsed.loggedIn;
	} catch {
		return null;
	}
}

export function parseClaudeModelFlagsFromHelp(output: string): readonly {
	readonly id: string;
	readonly label: string;
}[] {
	const aliases = output.match(
		/alias for the latest model[\s\S]*?'([^']+)',\s*'([^']+)',\s*or\s*'([^']+)'/i,
	);
	if (!aliases) return [];
	const fullName = output.match(/full name \(e\.g\.\s*'([^']+)'\)/i)?.[1];
	return [aliases[1], aliases[2], aliases[3]]
		.filter((id): id is string => Boolean(id))
		.map((id) => ({
			id,
			label: fullName?.includes(id) ? fullName : id,
		}));
}

export function parseClaudeCapabilitiesFromHelp(output: string): {
	readonly reasoning?: ListedReasoning;
	readonly supportsFastMode: boolean;
} {
	const match = output.match(/--effort\s+<level>[\s\S]{0,240}?\(([^)]+)\)/i);
	const ids = (match?.[1] ?? "")
		.split(/,|\bor\b/i)
		.map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
		.filter((value) => /^[a-z][a-z0-9_-]*$/i.test(value));
	const firstLevelId = ids[0];
	const defaultLevelId = ids.includes("medium") ? "medium" : firstLevelId;
	return {
		...(firstLevelId && defaultLevelId
			? {
					reasoning: {
						levels: [
							{ id: firstLevelId, label: firstLevelId },
							...ids.slice(1).map((id) => ({ id, label: id })),
						],
						defaultLevelId,
					},
				}
			: {}),
		supportsFastMode: /^\s*--fast(?:\s|,)/m.test(output),
	};
}

export function claudeBackgroundTurnResult(input: {
	readonly exitText: string | null;
	readonly output: string | null;
	readonly pidAlive: boolean;
	readonly pidFilePresent?: boolean;
}):
	| { readonly kind: "running" }
	| { readonly kind: "completed"; readonly text: string }
	| { readonly kind: "failed"; readonly message: string } {
	const exitText = input.exitText?.trim() ?? "";
	if (exitText) {
		const code = Number.parseInt(exitText, 10);
		const output = input.output?.trim() ?? "";
		if (code === 0 && output) return { kind: "completed", text: output };
		return {
			kind: "failed",
			message: output || "Claude Code did not return a response.",
		};
	}
	const streamed = claudeStreamTerminalResult(input.output);
	if (streamed?.kind === "failed") return streamed;
	if (streamed?.kind === "completed") {
		return { kind: "completed", text: input.output?.trim() ?? "" };
	}
	if (input.pidAlive || input.pidFilePresent === false) {
		return { kind: "running" };
	}
	const output = input.output?.trim() ?? "";
	if (output) return { kind: "completed", text: output };
	return {
		kind: "failed",
		message: "Claude Code stopped before it finished.",
	};
}

export function claudeListedModelsAreUsable(
	models: readonly { readonly id: string }[],
): boolean {
	return (
		models.length > 0 &&
		models.every(
			(model) =>
				/^[a-z][a-z0-9._:-]*$/i.test(model.id.trim()) && !/\s/.test(model.id),
		)
	);
}

export function parseClaudeListedModels(output: string): readonly {
	readonly id: string;
	readonly label: string;
}[] {
	const trimmed = output.trim();
	if (!trimmed) return [];
	const fromJson = modelsFromJson(trimmed);
	if (fromJson.length > 0) return fromJson;
	return modelsFromCliLines(trimmed);
}

function modelsFromJson(output: string): readonly {
	readonly id: string;
	readonly label: string;
}[] {
	try {
		const parsed: unknown = JSON.parse(output);
		return listedModelsFromUnknown(parsed);
	} catch {
		const start = output.indexOf("[");
		const end = output.lastIndexOf("]");
		if (start < 0 || end <= start) return [];
		try {
			return listedModelsFromUnknown(JSON.parse(output.slice(start, end + 1)));
		} catch {
			return [];
		}
	}
}

function listedModelsFromUnknown(value: unknown): readonly {
	readonly id: string;
	readonly label: string;
}[] {
	const rows = Array.isArray(value)
		? value
		: isRecord(value) && Array.isArray(value.models)
			? value.models
			: [];
	const models: { id: string; label: string }[] = [];
	for (const row of rows) {
		if (typeof row === "string" && row.trim()) {
			models.push({ id: row.trim(), label: row.trim() });
			continue;
		}
		if (!isRecord(row)) continue;
		const id =
			readString(row.id) ??
			readString(row.model) ??
			readString(row.slug) ??
			null;
		if (!id) continue;
		models.push({
			id,
			label: readString(row.label) ?? readString(row.name) ?? id,
		});
	}
	return models;
}

function modelsFromCliLines(output: string): readonly {
	readonly id: string;
	readonly label: string;
}[] {
	const models: { id: string; label: string }[] = [];
	const seen = new Set<string>();
	for (const rawLine of output.split("\n")) {
		const line = rawLine.trim().replace(/^\*\s*/, "");
		const withId = line.match(/^(.+?)\s+\(([^)]+)\)/);
		if (withId?.[1] && withId[2]) {
			const id = withId[2].trim();
			if (seen.has(id) || /\s/.test(id) || !/^[a-z][a-z0-9._:-]*$/i.test(id)) {
				continue;
			}
			seen.add(id);
			models.push({ id, label: withId[1].trim() });
			continue;
		}
		if (
			/^[a-z][a-z0-9._:-]*$/i.test(line) &&
			line.includes("-") &&
			!/\s/.test(line)
		) {
			if (seen.has(line)) continue;
			seen.add(line);
			models.push({ id: line, label: line });
		}
	}
	return models;
}

function stripTrailingPunctuation(value: string) {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip terminal control bytes from parsed CLI output.
	return value.replace(/[\x00-\x1f]/g, "").replace(/[).,;]+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}
