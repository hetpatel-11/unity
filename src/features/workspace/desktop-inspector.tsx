import { useEffect } from "react";
import {
	desktopInspectorPrompt,
	desktopInspectorShouldStart,
	type WorkspaceDesktop,
} from "#/domain/workspace-desktop";
import { DesktopStage } from "./desktop-stage";

export function DesktopInspector({
	desktop,
	busy,
	projectId,
	sessionId,
	onStart,
	active = true,
}: {
	desktop: WorkspaceDesktop;
	busy: boolean;
	projectId?: string;
	sessionId?: string;
	onStart: () => void;
	active?: boolean;
}) {
	const shouldStart = desktopInspectorShouldStart({
		tabActive: active,
		projectId,
		sessionId,
		desktop,
		busy,
	});

	useEffect(() => {
		if (!shouldStart) return;
		onStart();
	}, [shouldStart, onStart]);

	if (desktop.status === "running" && projectId && sessionId) {
		return (
			<section className="desktop-inspector" aria-label="Workspace desktop">
				<DesktopStage projectId={projectId} sessionId={sessionId} />
			</section>
		);
	}

	const prompt = desktopInspectorPrompt({ desktop, projectId, sessionId });

	return (
		<section
			className="inspector-empty desktop-inspector-empty"
			data-kind="desktop"
			aria-live="polite"
		>
			<h2>{prompt.title}</h2>
			<p>{prompt.description}</p>
			{desktop.status === "starting" || busy || shouldStart ? (
				<p className="desktop-inspector-status">Starting…</p>
			) : prompt.actionLabel ? (
				<button type="button" className="desktop-start" onClick={onStart}>
					{prompt.actionLabel}
				</button>
			) : null}
		</section>
	);
}
