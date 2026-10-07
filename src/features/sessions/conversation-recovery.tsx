import { GitFork, RotateCcw } from "lucide-react";
import { useState } from "react";

export function ConversationRecovery({
	codeAvailable,
	busy,
	onRecover,
}: {
	codeAvailable: boolean;
	busy: boolean;
	onRecover: (mode: "conversation" | "code" | "both" | "fork") => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	async function recover(mode: "conversation" | "code" | "both" | "fork") {
		setPending(true);
		setError("");
		try {
			await onRecover(mode);
			setOpen(false);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Recovery failed. Try again.",
			);
		} finally {
			setPending(false);
		}
	}
	return (
		<div className="conversation-recovery">
			<button
				type="button"
				disabled={busy || pending}
				aria-expanded={open}
				onClick={() => setOpen((value) => !value)}
			>
				<RotateCcw size={12} /> Recover from here
			</button>
			{open ? (
				<div className="conversation-recovery-options">
					<p className="conversation-recovery-explanation">
						Return to before this message. Previous conversation history is
						retained.
					</p>
					<button
						type="button"
						disabled={pending || busy}
						onClick={() => void recover("conversation")}
					>
						Restore conversation
					</button>
					{codeAvailable ? (
						<>
							<p className="conversation-recovery-explanation">
								Restoring code replaces later tracked and nonignored edits. A
								backup is saved first. Ignored files and external actions stay
								unchanged.
							</p>
							<button
								type="button"
								disabled={pending || busy}
								onClick={() => void recover("code")}
							>
								Restore code
							</button>
							<button
								type="button"
								disabled={pending || busy}
								onClick={() => void recover("both")}
							>
								Restore code and conversation
							</button>
						</>
					) : null}
					<button
						type="button"
						disabled={pending || busy}
						onClick={() => void recover("fork")}
					>
						<GitFork size={12} /> Fork conversation
					</button>
				</div>
			) : null}
			{error ? <p role="alert">{error}</p> : null}
		</div>
	);
}
