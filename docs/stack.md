# Unity stack

Selected hosting platform: InstaCloud.

- React/Vite: the existing Unity frontend.
- InstaCloud compute: the planned Unity HTTP API and captain event processor, serving the built frontend from the same application.
- InstaCloud managed Postgres: planned conversation history, agent events, agent state, pending decisions, and message routing records.
- Agent37 Cloud API: coding-agent execution environments. Required by the hackathon eligibility rules supplied by the user.
- OpenAI: captain inference for briefings and routing user instructions.

Planned flow: Agent37-hosted coding agent emits a turn event → Unity API stores it → captain produces a briefing → API streams the briefing to the unified conversation → user replies → captain routes the instruction to the intended agent.

Current state: frontend preview only. No backend, database, InstaCloud project, provider connection, or deployed service has been created.

InstaCloud's setup guide excludes static frontends whose only backend lives elsewhere. Deploy Unity once its own API exists. Use a single application container and managed Postgres. Account sign-in and project binding will be needed for deployment.

Official setup: https://instacloud.com/prompt.md
