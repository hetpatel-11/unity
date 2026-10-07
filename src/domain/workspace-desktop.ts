import { failureMessage, workspaceLooksGone } from "./failure-message";
import { publicFailureMessage } from "./project-workspace";

export const SHARED_DESKTOP_WIDTH = 1440;
export const SHARED_DESKTOP_HEIGHT = 900;

export type WorkspaceDesktop =
	| { readonly status: "stopped" }
	| { readonly status: "starting" }
	| {
			readonly status: "running";
			readonly viewerUrl: string | null;
			readonly display: ":0";
			readonly message: string | null;
	  }
	| { readonly status: "failed"; readonly reason: string };

export const START_HARNESS_BEFORE_DESKTOP =
	"Start a harness workspace before opening the desktop.";

export function desktopStartFailureReason(cause: unknown): string {
	const message = failureMessage(cause);
	if (workspaceLooksGone(message)) return START_HARNESS_BEFORE_DESKTOP;
	return publicFailureMessage(
		cause instanceof Error ? cause : new Error(message),
	);
}

export function desktopFailedBecauseWorkspaceGone(cause: unknown): boolean {
	return workspaceLooksGone(failureMessage(cause));
}

export function desktopViewerUrl(desktop: WorkspaceDesktop): string | null {
	return desktop.status === "running" ? desktop.viewerUrl : null;
}

export function desktopCanBeControlled(desktop: WorkspaceDesktop): boolean {
	return desktop.status === "running" && Boolean(desktop.viewerUrl);
}

export function desktopInspectorShouldStart(input: {
	readonly tabActive: boolean;
	readonly projectId?: string;
	readonly sessionId?: string;
	readonly desktop: WorkspaceDesktop;
	readonly busy: boolean;
}) {
	return Boolean(
		input.tabActive &&
			input.projectId &&
			input.sessionId &&
			!input.busy &&
			input.desktop.status === "stopped",
	);
}

export function desktopInspectorPrompt(input: {
	readonly desktop: WorkspaceDesktop;
	readonly projectId?: string;
	readonly sessionId?: string;
}) {
	if (input.desktop.status === "failed") {
		return {
			title: "Desktop failed to start.",
			description: input.desktop.reason,
			actionLabel: "Retry desktop",
		};
	}
	if (input.desktop.status === "starting") {
		return {
			title: "Starting desktop…",
			description:
				"This is the desktop the agent uses for QA. You watch and control the same screen.",
			actionLabel: null,
		};
	}
	if (!input.projectId) {
		return {
			title: "Shared desktop",
			description: "Select a project to use the desktop.",
			actionLabel: null,
		};
	}
	if (!input.sessionId) {
		return {
			title: "Shared desktop",
			description: "Connect an agent before opening the desktop.",
			actionLabel: null,
		};
	}
	if (input.desktop.status === "running") {
		return {
			title: "Desktop is running.",
			description:
				input.desktop.message ?? "You and the agent share this screen.",
			actionLabel: null,
		};
	}
	return {
		title: "Starting desktop…",
		description:
			"This is the desktop the agent uses for QA. You watch and control the same screen.",
		actionLabel: null,
	};
}

export function desktopClientViewerUrl(input: {
	readonly projectId: string;
	readonly sessionId?: string;
}) {
	const params = new URLSearchParams({ projectId: input.projectId });
	if (input.sessionId) params.set("sessionId", input.sessionId);
	return `/api/desktop?${params}`;
}

export function desktopRemoteOrigin(hostname: string) {
	return `https://${hostname.replace(/\/$/, "")}`;
}

export function desktopEmbedUrl(origin: string): string {
	return `${origin.replace(/\/$/, "")}/`;
}

export function desktopHostname(providerRef: string) {
	const slug = providerRef
		.replaceAll(/[^a-zA-Z0-9]/g, "")
		.slice(-12)
		.toLowerCase();
	return `ytimesy-desk-${slug || "local"}.style.dev`;
}

export function desktopViewerUrlForMachine(providerRef: string) {
	return desktopEmbedUrl(`https://${desktopHostname(providerRef)}`);
}

export function desktopPortIsListening(output: string) {
	return output.includes("YTIMESY_DESKTOP_UP");
}
