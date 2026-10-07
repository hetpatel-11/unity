import { Plug } from "lucide-react";
import type { AgentProviderId } from "#/domain/agent-provider";
import { ClaudeMark } from "./claude-mark";
import { CodexMark } from "./codex-mark";
import { OpenCodeMark } from "./opencode-mark";

export function AgentProviderMark({
	provider,
	size = 24,
}: {
	provider: AgentProviderId;
	size?: number;
}) {
	switch (provider) {
		case "api":
			return <Plug size={size} aria-hidden="true" />;
		case "codex":
			return <CodexMark size={size} />;
		case "claude":
			return <ClaudeMark size={size} />;
		case "opencode":
			return <OpenCodeMark size={size} />;
	}
}
