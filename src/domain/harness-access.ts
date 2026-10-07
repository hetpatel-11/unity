import type { AgentAuthMode, AgentConnection } from "./agent-connection";
import {
	type AgentProvider,
	type AgentProviderId,
	agentProviderById,
	offeredAgentProviders,
} from "./agent-provider";
import { claudeSessionRemembersSignIn } from "./claude-auth";
import { parseModelRouteId } from "./model-connection";
import { isTurnRunning, type SessionTurnStatus } from "./session-item";

export type HarnessReadiness =
	| "ready"
	| "authorizing"
	| "unsigned"
	| "failed"
	| "expired";

export type HarnessSubscriptionAction =
	| "sign_in"
	| "connect"
	| "open_provider"
	| "retry"
	| "sign_in_again";

export type HarnessAccess = {
	readonly provider: AgentProvider;
	readonly readiness: HarnessReadiness;
	readonly muted: boolean;
	readonly statusLabel: string;
	readonly summary: string;
	readonly subscriptionAction: HarnessSubscriptionAction | null;
	readonly subscriptionActionLabel: string | null;
	readonly apiKeyHint: string | null;
	readonly userCode: string | null;
	readonly verificationUrl: string | null;
};

export function offeredHarnessAccess(
	connection: AgentConnection,
	apiKeyHints: Readonly<Partial<Record<AgentProviderId, string>>> = {},
	options: { readonly codexSnapshotAvailable?: boolean } = {},
): readonly HarnessAccess[] {
	return offeredAgentProviders().map((provider) =>
		harnessAccess(
			provider,
			connection,
			apiKeyHints[provider.id] ?? null,
			options,
		),
	);
}

export function harnessAccess(
	provider: AgentProvider,
	connection: AgentConnection,
	apiKeyHint: string | null,
	options: { readonly codexSnapshotAvailable?: boolean } = {},
): HarnessAccess {
	const forThisProvider =
		connection.status !== "disconnected" && connection.provider === provider.id;
	if (forThisProvider && connection.status === "authenticated") {
		return readyAccess(
			provider,
			connection.authMode,
			connection.planType,
			apiKeyHint,
		);
	}
	if (forThisProvider && connection.status === "awaiting_device_code") {
		return {
			provider,
			readiness: "authorizing",
			muted: true,
			statusLabel: "Authorizing",
			summary: connection.userCode
				? `Enter this code on ${provider.authorizeWith}`
				: `Open ${provider.authorizeWith} to finish signing in. If it shows a code, paste it here.`,
			subscriptionAction: "open_provider",
			subscriptionActionLabel: `Open ${provider.authorizeWith}`,
			apiKeyHint,
			userCode: connection.userCode,
			verificationUrl: connection.verificationUrl,
		};
	}
	if (forThisProvider && connection.status === "failed") {
		return {
			provider,
			readiness: "failed",
			muted: true,
			statusLabel: "Failed",
			summary: connection.message,
			subscriptionAction: "retry",
			subscriptionActionLabel: "Try again",
			apiKeyHint,
			userCode: null,
			verificationUrl: null,
		};
	}
	if (forThisProvider && connection.status === "expired") {
		return {
			provider,
			readiness: "expired",
			muted: true,
			statusLabel: "Expired",
			summary: connection.message,
			subscriptionAction: "sign_in_again",
			subscriptionActionLabel: "Sign in again",
			apiKeyHint,
			userCode: null,
			verificationUrl: null,
		};
	}
	return unsignedAccess(provider, apiKeyHint, options);
}

export function harnessLoginIsPending(connection: AgentConnection): boolean {
	return connection.status === "awaiting_device_code";
}

export function claudeAuthNeedsPaste(connection: AgentConnection): boolean {
	return (
		connection.status === "awaiting_device_code" &&
		connection.provider === "claude"
	);
}

export function selectedHarnessIsConnected(
	connection: AgentConnection,
	harnessId: AgentProviderId,
): boolean {
	return (
		connection.status === "authenticated" && connection.provider === harnessId
	);
}

/**
 * Connect starts a paused VM. Reloading or selecting a chat that last looked
 * authenticated must not Connect — Send still resumes through
 * {@link canResumeDisconnectedFollowUp}.
 */
export function shouldAutoResumeHarnessSession(_input: {
	readonly harnessId: AgentProviderId;
	readonly connection: AgentConnection;
}): boolean {
	return false;
}

/**
 * Selecting a paused chat must not boot its VM. A follow-up or a side-agent
 * send may still start that harness: OpenCode can connect without an account;
 * Codex can resume a saved workspace; Claude can resume a chat that already
 * stored a Claude model after Anthropic sign-in.
 */
export function canResumeDisconnectedFollowUp(input: {
	readonly harnessId: AgentProviderId;
	readonly connection: AgentConnection;
	readonly turnStatus: SessionTurnStatus;
	readonly snapshotAvailable?: boolean;
	readonly listedModelId?: string | null;
}): boolean {
	if (isTurnRunning(input.turnStatus)) return false;
	if (input.connection.status !== "disconnected") return false;
	if (input.harnessId === "claude") {
		return claudeSessionRemembersSignIn(input.listedModelId);
	}
	if (input.harnessId === "codex") return Boolean(input.snapshotAvailable);
	return input.harnessId === "opencode";
}

export const RUNNING_TURN_POLL_MS = 700;

export function runningTurnShouldPoll(input: {
	readonly turnStatus: SessionTurnStatus;
	readonly sideTurnStatus: SessionTurnStatus;
	readonly connectionStatus: AgentConnection["status"];
	readonly composerBusy?: boolean;
}): boolean {
	return isTurnRunning(input.turnStatus) || isTurnRunning(input.sideTurnStatus);
}

export function composerCanStartSignIn(input: {
	readonly harnessId: AgentProviderId;
	readonly connection: AgentConnection;
	readonly snapshotAvailable?: boolean;
	readonly busy: boolean;
	readonly draft: string;
	readonly slashDraft: boolean;
}): boolean {
	if (input.busy || input.slashDraft || !input.draft.trim()) return false;
	if (!harnessRequiresAccountLogin(input.harnessId)) return false;
	if (selectedHarnessIsConnected(input.connection, input.harnessId)) {
		return false;
	}
	if (
		input.harnessId === "codex" &&
		input.connection.status === "disconnected" &&
		input.snapshotAvailable
	)
		return false;
	if (input.connection.status === "awaiting_device_code") return false;
	return input.harnessId === "claude" || input.harnessId === "codex";
}

export function composerSendIsEnabled(input: {
	readonly harnessId: AgentProviderId;
	readonly connection: AgentConnection;
	readonly turnStatus: SessionTurnStatus;
	readonly snapshotAvailable?: boolean;
	readonly listedModelId?: string | null;
	readonly canSend: boolean;
	readonly busy: boolean;
	readonly draft: string;
	readonly modelId: string;
	readonly slashDraft: boolean;
}): boolean {
	if (input.busy || input.slashDraft || !input.draft.trim()) return false;
	if (composerCanStartSignIn(input)) return true;
	if (input.harnessId === "api")
		return (
			input.turnStatus !== "running" &&
			parseModelRouteId(input.modelId) !== null
		);
	const harnessReady = selectedHarnessIsConnected(
		input.connection,
		input.harnessId,
	);
	const canResume = canResumeDisconnectedFollowUp(input);
	if (!harnessReady && !canResume) return false;
	if (harnessReady && !input.canSend && !canResume) return false;
	if (!canResume && !input.modelId) return false;
	return true;
}

/**
 * Sign in is not a wall. Show this only while Anthropic is waiting for a
 * paste, or after a failed/expired login. Send starts a first login.
 */
export function harnessLoginShouldShow(input: {
	readonly harnessReady: boolean;
	readonly connection: AgentConnection;
	readonly harnessId: AgentProviderId;
}): boolean {
	if (input.harnessReady) return false;
	const access = harnessAccess(
		agentProviderById(input.harnessId),
		input.connection,
		null,
	);
	return (
		access.readiness === "authorizing" ||
		access.readiness === "failed" ||
		access.readiness === "expired"
	);
}

export function harnessRequiresAccountLogin(
	harnessId: AgentProviderId,
): boolean {
	return harnessId === "codex" || harnessId === "claude";
}

function readyAccess(
	provider: AgentProvider,
	authMode: AgentAuthMode,
	planType: string | null,
	apiKeyHint: string | null,
): HarnessAccess {
	if (authMode === "apikey") {
		return {
			provider,
			readiness: "ready",
			muted: false,
			statusLabel: "API key",
			summary: "Using a stored API key",
			subscriptionAction: null,
			subscriptionActionLabel: null,
			apiKeyHint,
			userCode: null,
			verificationUrl: null,
		};
	}
	if (authMode === "local") {
		return {
			provider,
			readiness: "ready",
			muted: false,
			statusLabel: "Connected",
			summary: planType ?? "Running on this workspace",
			subscriptionAction: null,
			subscriptionActionLabel: null,
			apiKeyHint,
			userCode: null,
			verificationUrl: null,
		};
	}
	return {
		provider,
		readiness: "ready",
		muted: false,
		statusLabel: "Signed in",
		summary: planType
			? planType
			: provider.signInMethod
				? `Signed in with ${provider.signInMethod}`
				: "Running on this workspace",
		subscriptionAction: null,
		subscriptionActionLabel: null,
		apiKeyHint,
		userCode: null,
		verificationUrl: null,
	};
}

function unsignedAccess(
	provider: AgentProvider,
	apiKeyHint: string | null,
	options: { readonly codexSnapshotAvailable?: boolean } = {},
): HarnessAccess {
	if (provider.id === "api")
		return {
			provider,
			readiness: "unsigned",
			muted: true,
			statusLabel: "Not connected",
			summary: "Add an API connection in Settings, then select a model.",
			subscriptionAction: null,
			subscriptionActionLabel: null,
			apiKeyHint: null,
			userCode: null,
			verificationUrl: null,
		};
	if (provider.id === "claude") {
		return {
			provider,
			readiness: "unsigned",
			muted: true,
			statusLabel: apiKeyHint ? "Key saved" : "Not signed in",
			summary: apiKeyHint
				? `Key ${apiKeyHint} is stored. Send a task to finish signing in.`
				: "Type a task and send. Anthropic opens if you still need to sign in.",
			subscriptionAction: "sign_in",
			subscriptionActionLabel: "Sign in",
			apiKeyHint,
			userCode: null,
			verificationUrl: null,
		};
	}
	if (provider.id === "opencode") {
		return {
			provider,
			readiness: "unsigned",
			muted: false,
			statusLabel: apiKeyHint ? "Key saved" : "Not connected",
			summary: apiKeyHint
				? `Key ${apiKeyHint} is stored. Connect OpenCode to attach it. No account is required.`
				: "Connect OpenCode on the workspace. No account is required. Paste a provider key only if you want extra models.",
			subscriptionAction: "connect",
			subscriptionActionLabel: "Connect",
			apiKeyHint,
			userCode: null,
			verificationUrl: null,
		};
	}
	return {
		provider,
		readiness: "unsigned",
		muted: true,
		statusLabel: options.codexSnapshotAvailable
			? "Saved workspace"
			: apiKeyHint
				? "Key saved"
				: "Not signed in",
		summary: options.codexSnapshotAvailable
			? "Resume ChatGPT from the saved workspace."
			: apiKeyHint
				? `Key ${apiKeyHint} is stored. Sign in with ChatGPT to use Codex.`
				: "Sign in with ChatGPT, or paste an API key.",
		subscriptionAction: "sign_in",
		subscriptionActionLabel: options.codexSnapshotAvailable
			? "Resume"
			: "Sign in",
		apiKeyHint,
		userCode: null,
		verificationUrl: null,
	};
}
