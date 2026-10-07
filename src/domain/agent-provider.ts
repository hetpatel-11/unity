export type AgentProviderId = "codex" | "claude" | "opencode" | "api";

export const DEFAULT_COMPOSER_HARNESS_ID: AgentProviderId = "codex";

export type AgentProvider = {
	readonly id: AgentProviderId;
	readonly name: string;
	readonly signInMethod: string | null;
	readonly authorizeWith: string;
};

export const CODEX_PROVIDER: AgentProvider = {
	id: "codex",
	name: "Codex",
	signInMethod: "ChatGPT",
	authorizeWith: "OpenAI",
};

export const CLAUDE_PROVIDER: AgentProvider = {
	id: "claude",
	name: "Claude Code",
	signInMethod: "Claude account",
	authorizeWith: "Anthropic",
};

export const OPENCODE_PROVIDER: AgentProvider = {
	id: "opencode",
	name: "OpenCode",
	signInMethod: null,
	authorizeWith: "workspace",
};

export function offeredAgentProviders(): readonly AgentProvider[] {
	return [CODEX_PROVIDER, CLAUDE_PROVIDER, API_PROVIDER];
}

export const API_PROVIDER: AgentProvider = {
	id: "api",
	name: "API models",
	signInMethod: null,
	authorizeWith: "API connection",
};

export function parseRuntimeId(
	value: string,
): Exclude<AgentProviderId, "opencode"> {
	if (value === "codex" || value === "claude" || value === "api") return value;
	throw new Error("Unsupported runtime");
}

export function recognizedAgentProviders(): readonly AgentProvider[] {
	return [CODEX_PROVIDER, CLAUDE_PROVIDER, OPENCODE_PROVIDER, API_PROVIDER];
}

export function offeredAgentProviderId(id: AgentProviderId): AgentProviderId {
	return offeredAgentProviders().some((provider) => provider.id === id)
		? id
		: DEFAULT_COMPOSER_HARNESS_ID;
}

export function agentProviderById(id: AgentProviderId): AgentProvider {
	switch (id) {
		case "api":
			return API_PROVIDER;
		case "codex":
			return CODEX_PROVIDER;
		case "claude":
			return CLAUDE_PROVIDER;
		case "opencode":
			return OPENCODE_PROVIDER;
	}
}
