import type { AgentConnection } from "#/domain/agent-connection";
import {
	type AgentProviderId,
	agentProviderById,
} from "#/domain/agent-provider";
import { harnessAccess } from "#/domain/harness-access";

export function HarnessLogin({
	harnessId,
	connection,
	busy,
	onConnect,
}: {
	harnessId: AgentProviderId;
	connection: AgentConnection;
	busy: boolean;
	onConnect: () => void;
}) {
	const access = harnessAccess(agentProviderById(harnessId), connection, null);
	if (harnessId === "claude") return null;
	if (access.readiness === "ready") return null;
	if (
		access.readiness !== "authorizing" &&
		access.readiness !== "failed" &&
		access.readiness !== "expired"
	) {
		return null;
	}

	return (
		<div className="harness-login">
			<p className="harness-login-copy">{access.summary}</p>
			{access.userCode ? (
				<p className="harness-login-code">{access.userCode}</p>
			) : null}

			<div className="harness-login-row">
				{access.verificationUrl ? (
					<a
						className="harness-login-action"
						href={access.verificationUrl}
						target="_blank"
						rel="noreferrer"
					>
						{access.subscriptionActionLabel ?? "Open"}
					</a>
				) : access.subscriptionActionLabel ? (
					<button
						type="button"
						className="harness-login-action"
						disabled={busy}
						onClick={onConnect}
					>
						{access.subscriptionActionLabel}
					</button>
				) : null}
			</div>
		</div>
	);
}
