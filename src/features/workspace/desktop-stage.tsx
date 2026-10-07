import { useEffect, useRef } from "react";
import { desktopClientViewerUrl } from "#/domain/workspace-desktop";

export function DesktopStage({
	projectId,
	sessionId,
}: {
	projectId: string;
	sessionId: string;
}) {
	const host = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const target = host.current;
		if (!target) return;
		let disposed = false;
		let rfb: { disconnect(): void } | null = null;

		void import("@novnc/novnc").then(({ default: RFB }) => {
			if (disposed) return;
			const protocol = window.location.protocol === "https:" ? "wss" : "ws";
			const path = desktopClientViewerUrl({ projectId, sessionId });
			const client = new RFB(
				target,
				`${protocol}://${window.location.host}${path}`,
			);
			client.scaleViewport = true;
			client.clipViewport = true;
			client.resizeSession = false;
			client.showDotCursor = true;
			client.background = "#111111";
			rfb = client;
		});

		return () => {
			disposed = true;
			try {
				rfb?.disconnect();
			} catch {
				target.replaceChildren();
			}
		};
	}, [projectId, sessionId]);

	return <div className="desktop-stage-rfb" ref={host} />;
}
