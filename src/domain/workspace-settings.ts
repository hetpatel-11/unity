import type { AgentProviderId } from "./agent-provider";
import { agentProviderById } from "./agent-provider";
import type { UserAgentAccount } from "./user-agent-account";

export type SettingsSection = "account" | "github" | "project" | "agents";

export function settingsNavItems(): readonly {
	readonly id: SettingsSection;
	readonly label: string;
}[] {
	return [
		{ id: "account", label: "Account" },
		{ id: "github", label: "GitHub" },
		{ id: "project", label: "Project" },
		{ id: "agents", label: "Agents" },
	];
}

export function accountDisplayName(input: {
	readonly name?: string | null;
	readonly email?: string | null;
}): string {
	const name = input.name?.trim();
	if (name) return name;
	const email = input.email?.trim();
	if (email) return email.split("@")[0] || email;
	return "Signed in";
}

export function accountInitials(input: {
	readonly name?: string | null;
	readonly email?: string | null;
}): string {
	const source = accountDisplayName(input);
	const parts = source.split(/[\s._-]+/).filter(Boolean);
	const letters = (parts[0]?.[0] ?? "y") + (parts[1]?.[0] ?? "");
	return letters.slice(0, 2).toUpperCase();
}

export function githubConnectionCopy(connected: boolean): string {
	return connected
		? "GitHub is connected. ytimesy can clone the repositories you granted."
		: "Connect GitHub to add a repository and start a chat.";
}

export function harnessSettingsCopy(input: {
	readonly id: AgentProviderId;
	readonly account: UserAgentAccount | null;
}): string {
	if (input.id === "codex") {
		if (input.account?.status === "connected") {
			const email = input.account.email?.trim();
			return email ? `ChatGPT connected as ${email}.` : "ChatGPT is connected.";
		}
		if (input.account?.status === "expired") {
			return (
				input.account.message ||
				"ChatGPT sign-in expired. Reconnect from the composer."
			);
		}
	}
	return `Connect ${agentProviderById(input.id).name} from the harness picker in the composer.`;
}
