export type AgentProvider = "codex";

export type UserAgentAccount =
	| { status: "disconnected" }
	| {
			status: "connected";
			provider: AgentProvider;
			planType: string | null;
			email: string | null;
	  }
	| { status: "expired"; message: string };

export function agentAccountIsReady(account: UserAgentAccount) {
	return account.status === "connected";
}
