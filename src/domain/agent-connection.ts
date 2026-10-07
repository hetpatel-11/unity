import { type AgentProviderId, agentProviderById } from "./agent-provider";

export type AgentAuthMode = "chatgpt" | "apikey" | "subscription" | "local";

export type AgentConnection =
	| { readonly status: "disconnected" }
	| {
			readonly status: "awaiting_device_code";
			readonly provider: AgentProviderId;
			readonly loginId: string;
			readonly verificationUrl: string;
			readonly userCode: string;
	  }
	| {
			readonly status: "authenticated";
			readonly provider: AgentProviderId;
			readonly authMode: AgentAuthMode;
			readonly planType: string | null;
			readonly email: string | null;
	  }
	| {
			readonly status: "expired";
			readonly provider: AgentProviderId;
			readonly message: string;
	  }
	| {
			readonly status: "failed";
			readonly provider: AgentProviderId;
			readonly message: string;
	  };

export function isAuthenticatedAgent(
	connection: AgentConnection,
): connection is Extract<AgentConnection, { status: "authenticated" }> {
	return connection.status === "authenticated";
}

export function canStartAgentTurn(connection: AgentConnection): boolean {
	return connection.status === "authenticated";
}

export function connectedProviderId(
	connection: AgentConnection,
): AgentProviderId | null {
	if (connection.status === "disconnected") return null;
	if (connection.status === "authenticated") return connection.provider;
	return null;
}

export function connectedAgentStatus(
	connection: AgentConnection,
): string | null {
	if (connection.status !== "authenticated") return null;
	const name = agentProviderById(connection.provider).name;
	if (connection.authMode === "apikey") return `${name} · API key`;
	return connection.planType ? `${name} · ${connection.planType}` : name;
}
