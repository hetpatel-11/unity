import { Circle, CircleCheck } from "lucide-react";
import type { AgentTodo } from "#/domain/agent-todos";

export function TodoList({ todos }: { todos: readonly AgentTodo[] }) {
	return (
		<section className="overview-section overview-todos" aria-label="Todos">
			<h2>
				Todos{" "}
				<span>
					{todos.filter((todo) => todo.status === "completed").length}/
					{todos.length}
				</span>
			</h2>
			<ol>
				{todos.map((todo, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: Provider todo snapshots have no IDs and may repeat text; these rows hold no local state.
					<li key={`${index}:${todo.text}`} data-status={todo.status}>
						<span
							className="todo-status"
							role="img"
							aria-label={
								todo.status === "completed"
									? "Completed"
									: todo.status === "in_progress"
										? "In progress"
										: "Pending"
							}
						>
							{todo.status === "completed" ? (
								<CircleCheck size={16} />
							) : (
								<Circle size={16} />
							)}
						</span>
						{todo.status === "completed" ? (
							<s>{todo.text}</s>
						) : (
							<span>{todo.text}</span>
						)}
					</li>
				))}
			</ol>
		</section>
	);
}
