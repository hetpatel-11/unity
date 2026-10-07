# Unity supervisor

Goal: one user conversation that supervises all coding threads, including progress, completed work, blockers, and follow-up instructions.

Implemented runtime:

- Independent Codex sessions run on Agent37, using the user's own device login and retained remote session IDs.
- A Node collector persists transcripts, streams activity, queues instructions for busy chats, cancels turns, and reconnects by response ID. Replayed output replaces the same message rather than duplicating it.
- An Eve supervisor has tools to list/read/start/control chats and report observed summaries and user questions. Meaningful completion/failure events wake it; token updates go directly to the UI.
- Coding delegation uses a structured `delegate_task` brief with goal, context, constraints, and verification; literal relays use `control_thread`. Delivery responses distinguish queued instructions from dispatched work. Eve action and message events stream into the original ytimesy expandable tool timeline and loading indicators.
- Each project has its own Unity conversation, supervisor history, and ten ordinary Codex chats. The original sidebar/chat/inspector UI is retained. Trusted Eve session identities scope tools to the matching project.
- InstaCloud serves a labeled simulated demo from one container, with JSON state on a persistent volume. Local live mode uses Eve's supported ChatGPT connection. Hosted live mode requires its own configured API model connection.

Live smoke verification initially covered three independent Agent37 Codex chats, one Eve supervisor briefing, provider-question detection, natural-language GitHub decision routing into the same worker session, and completion reports. Worker tasks used distinct `/tmp/unity-demo-*` directories. The expanded demo registers twenty independent real Codex chats across two projects. This is a bounded demo, not an arbitrary repository benchmark.

See README.md for startup, deployment and crash-delivery limits. This prototype has no database, artifact inspection tool, global concurrency scheduler or automatic merging.

## Capy behavior to match (October 7 research)

Capy's October changelog defines Captain as a long-running thread directing other threads as its crew. The current public API exposes Captain creation with name, project, initial brief, and model; crew thread listings; needsYou and crewNeedsYou indicators; and a persistent Markdown digest read from DIGEST.md, ONGOING.md, or NOTES.md.

Its subagent documentation distinguishes two forms of coordination:
- Child subagents: final results and blocked questions wake the parent; interim progress is read on demand.
- Sibling threads: independent long-lived workstreams that an orchestrating agent can create and message; the orchestrator explicitly reads their state to learn progress.

The public docs do not disclose the dedicated Captain's complete internal prompt, exact crew-event wake rules, or implementation. Do not infer those from the child-subagent mechanism.

Unity should implement one durable Eve supervisor conversation, an explicit registry of crew Codex sessions, per-thread attention state, and a maintained digest. Live activity updates UI state; meaningful outcomes/decisions enter the supervisor's event queue. Provide tools to create, inspect, message, and stop crew sessions and inspect evidence. Review outcomes against assigned acceptance criteria and send targeted revisions where necessary. Relay questions to the human only when Unity cannot resolve them from the user's brief and existing decisions.

The earlier February Captain/Build article describes a per-task planner/executor split; the October dedicated Captain/crew API is the closer reference for Unity's cross-thread goal. This is an existing product pattern, not an unclaimed market gap.

Sources:
- https://capy.ai/changelog (October 1 Captain experiment)
- https://docs.capy.ai/api-reference/captains/create-captain
- https://docs.capy.ai/api-reference/captains/list-captain-crew
- https://docs.capy.ai/api-reference/captains/get-captain-digest
- https://docs.capy.ai/subagents
- https://docs.capy.ai/threads
