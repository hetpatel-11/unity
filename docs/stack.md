# Unity stack

- React/Vite: light interface, original ytimesy UI components, Unity activation and crew views.
- Node HTTP API: live SSE, atomic persisted room state, worker streams and control, private Eve tool routes.
- Agent37 Cloud APIs: independently sessioned Codex workers on the user's signed-in instance.
- Vercel Eve: a persistent Unity supervisor using custom tools to inspect and control those chats.
- InstaCloud: one application container with a persistent volume for room state and, when configured, Eve workflow state.

Local live mode uses Eve's supported local ChatGPT connection. Deployed live mode requires a separately provisioned model API key. The hosted presentation defaults to clearly labeled simulated mode; it is separate from the locally verified real Agent37/Eve sessions.

Flow: Codex completes a turn → Unity saves the transcript → Eve inspects the worker and briefs the user → user answers Unity → Eve routes the instruction into that worker's retained Codex session.

There is no database requirement in this prototype: a single API process owns the atomic JSON store. Horizontal scaling and stronger crash delivery semantics are future work.
