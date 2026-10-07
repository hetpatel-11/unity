export type SlashCommandId =
	| "stop"
	| "retry"
	| "model"
	| "files"
	| "diff"
	| "terminal"
	| "desktop";

export type SlashCommandAvailability = "ready" | "unavailable";

export type SlashCommand = {
	readonly id: SlashCommandId;
	readonly trigger: string;
	readonly label: string;
	readonly description: string;
	readonly availability: SlashCommandAvailability;
	readonly unavailableReason?: string;
};

export type SlashDraft = {
	readonly query: string;
	readonly argument: string;
};

export type SlashCommandContext = {
	readonly authenticated: boolean;
	readonly requiresAccountLogin: boolean;
	readonly turnRunning: boolean;
	readonly canSend: boolean;
	readonly hasLastUserMessage: boolean;
	readonly hasModels: boolean;
};

export function parseSlashDraft(draft: string): SlashDraft | null {
	if (!draft.startsWith("/") || draft.includes("\n")) return null;
	const body = draft.slice(1);
	const space = body.search(/\s/);
	if (space === -1) return { query: body.toLowerCase(), argument: "" };
	return {
		query: body.slice(0, space).toLowerCase(),
		argument: body.slice(space).trim(),
	};
}

export function composerSlashCommands(
	context: SlashCommandContext,
): readonly SlashCommand[] {
	const startHint = context.requiresAccountLogin
		? "Sign in to an agent"
		: "Connect an agent";
	return [
		{
			id: "stop",
			trigger: "/stop",
			label: "Stop",
			description: "Cancel the run you are viewing",
			availability: context.turnRunning ? "ready" : "unavailable",
			unavailableReason: "No run is in progress",
		},
		{
			id: "retry",
			trigger: "/retry",
			label: "Retry",
			description: "Send the last task again",
			availability:
				context.canSend && context.hasLastUserMessage ? "ready" : "unavailable",
			unavailableReason: context.turnRunning
				? "Wait for the current run to finish"
				: "Nothing to retry yet",
		},
		{
			id: "model",
			trigger: "/model",
			label: "Model",
			description: "Switch the model for the next run",
			availability: context.hasModels ? "ready" : "unavailable",
			unavailableReason: `${startHint} to load models`,
		},
		{
			id: "files",
			trigger: "/files",
			label: "Files",
			description: "Show the workspace file tree",
			availability: "ready",
		},
		{
			id: "diff",
			trigger: "/diff",
			label: "Diff",
			description: "Show file changes",
			availability: "ready",
		},
		{
			id: "terminal",
			trigger: "/terminal",
			label: "Terminal",
			description: "Show the workspace terminal",
			availability: "ready",
		},
		{
			id: "desktop",
			trigger: "/desktop",
			label: "Desktop",
			description: "Show the shared workspace desktop",
			availability: "ready",
		},
	];
}

export function slashCommandMatches(
	command: SlashCommand,
	query: string,
): boolean {
	if (query.length === 0) return true;
	if (command.trigger.slice(1).startsWith(query)) return true;
	if (command.id.startsWith(query)) return true;
	return command.label
		.toLowerCase()
		.split(/\s+/)
		.some((word) => word.startsWith(query));
}

export function matchingSlashCommands(
	draft: SlashDraft,
	commands: readonly SlashCommand[],
): SlashCommand[] {
	const matched = commands.filter((command) =>
		slashCommandMatches(command, draft.query),
	);
	if (draft.query.length === 0) {
		const ready = matched.filter((command) => command.availability === "ready");
		if (ready.length > 0) return ready;
	}
	return matched.sort((left, right) => {
		if (left.availability === right.availability) return 0;
		return left.availability === "ready" ? -1 : 1;
	});
}
