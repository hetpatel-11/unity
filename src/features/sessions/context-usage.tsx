import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import type { CodexUsage } from "#/domain/codex-usage";

const tokens = new Intl.NumberFormat("en", {
	notation: "compact",
	maximumFractionDigits: 1,
});

export function ContextUsage({
	context,
	compacting = false,
}: {
	context?: CodexUsage["context"];
	compacting?: boolean;
}) {
	const capacity = context?.modelContextWindow;
	const used = context?.last.totalTokens;
	const percent =
		capacity && used !== undefined
			? Math.min(100, (used / capacity) * 100)
			: null;
	if (percent === null && !compacting) return null;
	return (
		<Popover>
			<PopoverTrigger
				className="context-usage-trigger"
				data-compacting={compacting}
				aria-label={
					compacting
						? "Compacting context…"
						: percent === null
							? "Context usage unavailable"
							: `Context: ${Math.round(percent)}% used`
				}
			>
				<svg
					className={compacting ? "context-compacting-ring" : undefined}
					width="19"
					height="19"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<circle
						cx="12"
						cy="12"
						r="9"
						fill="none"
						stroke="currentColor"
						strokeOpacity="0.2"
						strokeWidth="2"
					/>
					{percent !== null ? (
						<circle
							cx="12"
							cy="12"
							r="9"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							pathLength="100"
							strokeDasharray={`${percent} 100`}
							transform="rotate(-90 12 12)"
						/>
					) : null}
				</svg>
				{compacting ? <span role="status">Compacting context…</span> : null}
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="end"
				collisionPadding={12}
				className="context-usage-popover"
			>
				<div className="context-usage-title">
					{compacting ? "Compacting context…" : "Context window:"}
				</div>
				{percent !== null && capacity && used !== undefined ? (
					<>
						<div className="context-usage-percent">
							{Math.round(percent)}% full
						</div>
						<div className="context-usage-tokens">
							{tokens.format(used)} / {tokens.format(capacity)} tokens used
						</div>
					</>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
