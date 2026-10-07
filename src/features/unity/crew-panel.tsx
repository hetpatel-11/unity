import {
	ArrowUpRight,
	Check,
	ChevronRight,
	Clock,
	MessageCircle,
	Pause,
	Play,
	Radio,
} from "lucide-react";
import type { UnityRoom, UnityThread, ThreadAction } from "#/domain/unity";
export const statusLabels = {
	running: "Working",
	waiting: "Needs you",
	ready: "Ready to review",
	paused: "Paused",
	failed: "Failed",
	idle: "Idle",
};
export function ThreadStatus({ thread }: { thread: UnityThread }) {
	return (
		<span className={`unity-status status-${thread.status}`}>
			<i />
			{statusLabels[thread.status]}
		</span>
	);
}
export function CrewPanel({
	room,
	onOpen,
	onControl,
	onMessage,
}: {
	room: UnityRoom;
	onOpen: (id: string) => void;
	onControl: (id: string, action: ThreadAction) => void;
	onMessage: (id: string) => void;
}) {
	return (
		<aside className="unity-crew" aria-label="Crew">
			<header>
				<span>
					<Radio size={15} /> Crew
				</span>
				<span>{room.threads.length} chats</span>
			</header>
			<div className="unity-crew-scroll">
				<div className="crew-summary">
					<strong>
						{room.threads.filter((t) => t.status === "running").length} working
					</strong>
					<span>
						{
							room.threads.filter((t) => t.question || t.status === "failed")
								.length
						}{" "}
						need you
					</span>
				</div>
				{room.threads.map((thread) => (
					<article
						className={`crew-card ${thread.question ? "needs-you" : ""}`}
						key={thread.id}
					>
						<div className="crew-card-heading">
							<span className="thread-avatar">{thread.title.slice(0, 1)}</span>
							<button onClick={() => onOpen(thread.id)}>
								{thread.title}
								<ArrowUpRight size={13} />
							</button>
						</div>
						<ThreadStatus thread={thread} />
						<p>{thread.summary}</p>
						{thread.question && (
							<div className="crew-question">
								<MessageCircle size={14} />
								{thread.question}
							</div>
						)}
						<div className="crew-card-actions">
							<button onClick={() => onMessage(thread.id)}>
								<MessageCircle size={13} />
								Message
							</button>
							<button
								onClick={() =>
									onControl(
										thread.id,
										thread.status === "running" ? "pause" : "resume",
									)
								}
							>
								{thread.status === "running" ? (
									<Pause size={13} />
								) : (
									<Play size={13} />
								)}{" "}
								{thread.status === "running" ? "Pause" : "Resume"}
							</button>
							{thread.status === "ready" && (
								<button onClick={() => onControl(thread.id, "review")}>
									<Check size={13} />
									Review
								</button>
							)}
						</div>
					</article>
				))}
				<section className="crew-events">
					<h3>
						<Clock size={13} />
						Recent activity
					</h3>
					{room.events.length ? (
						room.events.slice(0, 8).map((event) => (
							<div key={event.id}>
								<span>
									{room.threads.find((t) => t.id === event.threadId)?.title ??
										"Unity"}
								</span>
								<p>{event.text}</p>
							</div>
						))
					) : (
						<p>Turn results and routed instructions will appear here.</p>
					)}
				</section>
			</div>
			<footer>
				<Check size={13} /> Separate chats. Shared direction.
			</footer>
		</aside>
	);
}
