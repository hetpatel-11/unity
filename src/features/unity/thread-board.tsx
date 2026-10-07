import { ArrowUpRight, ArrowRight, Sparkles } from "lucide-react";
import type { UnityRoom } from "#/domain/unity";
import { ThreadStatus } from "./crew-panel";
export function ThreadBoard({
	room,
	onOpen,
	onActivate,
	onCreate,
}: {
	room: UnityRoom;
	onOpen: (id: string) => void;
	onActivate: () => void;
	onCreate: () => void;
}) {
	return (
		<section className="thread-board">
			<header className="board-header">
				<div className="board-eyebrow">YOUR WORKSPACE</div>
				<h1>
					Each chat has a task.
					<br />
					<span>Unity keeps them together.</span>
				</h1>
				<p>
					Your agents have their own conversations. Bring them under one leader
					to follow the work and direct what happens next.
				</p>
			</header>
			<div className="thread-board-grid">
				{room.threads.map((thread) => (
					<article className="thread-preview" key={thread.id}>
						<header>
							<span className="thread-avatar">{thread.title.slice(0, 1)}</span>
							<strong>{thread.title}</strong>
							<ArrowUpRight size={15} />
						</header>
						<ThreadStatus thread={thread} />
						<div className="thread-preview-messages">
							{thread.messages.slice(-2).map((message) => (
								<div
									key={message.id}
									className={`preview-message ${message.role}`}
								>
									<span>{message.role === "user" ? "You" : "Codex"}</span>
									<p>{message.text}</p>
								</div>
							))}
						</div>
						<button className="thread-open" onClick={() => onOpen(thread.id)}>
							Open chat <ArrowRight size={14} />
						</button>
					</article>
				))}
			</div>
			{room.threads.length === 0 && (
				<button className="unity-primary" onClick={onCreate}>
					Start your first Codex chat
				</button>
			)}
			<div className="activation-callout">
				<div className="unity-mark-wrap">
					<img src="/brand/unity.svg" alt="" />
				</div>
				<div>
					<strong>One conversation to lead them all.</strong>
					<p>
						Unity reads the chats, brings back decisions, and carries your
						instructions.
					</p>
				</div>
				<button
					className="unity-primary"
					onClick={onActivate}
					disabled={!room.threads.length}
				>
					<Sparkles size={16} /> Activate Unity
				</button>
			</div>
		</section>
	);
}
export function ActivationScene({ count }: { count: number }) {
	return (
		<div
			className="unity-activation"
			role="status"
			aria-label="Activating Unity"
		>
			<div className="activation-constellation">
				{Array.from({ length: Math.min(count, 6) }, (_, i) => (
					<div
						className="gathering-chat"
						key={i}
						style={
							{
								"--index": i,
								"--count": Math.min(count, 6),
							} as React.CSSProperties
						}
					>
						<span />
						<span />
						<span />
					</div>
				))}
				<div className="activation-core">
					<img src="/brand/unity.svg" alt="Unity" />
				</div>
			</div>
			<h2>Bringing your chats together</h2>
			<p>One leader. {count} independent conversations.</p>
		</div>
	);
}
