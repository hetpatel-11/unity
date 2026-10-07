import { useEffect, useState } from "react";
import { PanelRight, Plus, X } from "lucide-react";
import { ProjectSidebar } from "./features/workspace/project-sidebar";
import { WorkspacePanes } from "./features/workspace/workspace-panes";
import {
  WorkspaceInspector,
  type InspectorView,
  type ToolsView,
} from "./features/workspace/workspace-inspector";
import { WorkspaceOverview } from "./features/workspace/workspace-overview";
import { SessionLauncher } from "./features/sessions/session-launcher";
import type { PublicCodexSession } from "./domain/session-view";
import type {SessionItem} from "./domain/session-item";
import type { AgentTask } from "./domain/agent-task";
import { SessionItemId } from "./domain/ids";
import { AgentAvatar } from "./features/unity/agent-avatar";
import { useRoom } from "./features/unity/use-room";

export function App() {
  const { workspace, connected, error, setError, act, locked, unlock } =
    useRoom();
  const [projectId, setProjectId] = useState("forge");
  const [chatId, setChatId] = useState("unity:forge");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 760);
  const [inspectorOpen, setInspectorOpen] = useState(window.innerWidth >= 1100);
  const [compact, setCompact] = useState(window.innerWidth < 900);
  const [ratio, setRatio] = useState(0.58);
  const [view, setView] = useState<InspectorView>("overview");
  const [newChat, setNewChat] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const resize = () => setCompact(window.innerWidth < 900);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  if (locked)
    return (
      <div className="unity-loading">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await unlock(String(new FormData(e.currentTarget).get("token")));
            } catch {}
          }}
        >
          <h1>Open Unity</h1>
          <input
            name="token"
            type="password"
            aria-label="Workspace key"
            required
          />
          <button>Connect</button>
          <p>{error}</p>
        </form>
      </div>
    );
  if (!workspace)
    return <div className="unity-loading">{error || "Connecting…"}</div>;
  const selected =
    workspace.projects.find((p) => p.id === projectId) ?? workspace.projects[0];
  const room = selected.room;
  const projects = workspace.projects.map((p, i) => ({
    id: p.id,
    repositoryId: i + 1,
    installationId: 1,
    fullName: `workspace/${p.name}`,
    branch: "main",
  }));
  const project = projects.find((p) => p.id === selected.id)!;
  const isUnity = chatId.startsWith("unity:");
  const thread = room.threads.find((t) => t.id === chatId);
  const reverseRoundIndex = [...room.messages]
    .reverse()
    .findIndex((m) => m.text.startsWith("**New demo round."));
  const roundIndex =
    reverseRoundIndex < 0 ? 0 : room.messages.length - reverseRoundIndex - 1;
  const messages = isUnity
    ? room.messages.slice(Math.max(0, roundIndex))
    : (thread?.messages ?? []);
  const perform = (path: string, body: unknown = {}) =>
    void act(path, body, selected.id).catch(() => {});
  const switchProject = (id: string) => {
    setProjectId(id);
    setChatId(`unity:${id}`);
  };
  const openInspector = (next: ToolsView) => {
    setView(next);
    setInspectorOpen(true);
  };
  const session: PublicCodexSession = {
    snapshotAvailable: false,
    workspaceId: null,
    agentSessionId: chatId,
    connection: {
      status: "authenticated",
      provider: "codex",
      authMode: "local",
      planType: room.mode === "demo" ? "Demo" : "Codex",
      email: null,
    },
    models: [{ id: "unity-preview", label: isUnity ? "Unity" : "Codex" }],
    listedModelId: "unity-preview",
    blockedListedModelIds: [],
    canSend: connected,
    canSendSide: false,
    turnStatus: (isUnity ? room.supervisorBusy : thread?.status === "running")
      ? "running"
      : "idle",
    items: [...messages.map(m=>({at:m.at,item:(m.role==="user"?{kind:"userMessage",id:SessionItemId(m.id),text:m.text}:{kind:"agentMessage",id:SessionItemId(m.id),text:m.text,streaming:m.streaming,phase:"final_answer"}) as SessionItem})),...(isUnity?room.supervisorTools.filter(t=>t.at>=(messages[0]?.at??"")).map(t=>({at:t.at,item:{kind:"dynamicToolCall",id:SessionItemId(t.id),tool:t.name,input:t.input,output:t.output,status:t.status} as SessionItem})):[])].sort((a,b)=>a.at.localeCompare(b.at)).map(entry=>entry.item),
    sideTurnStatus: "idle",
    sideItems: [],
  };
  const tasks: AgentTask[] = room.threads.map((t) => ({
    id: t.id,
    parentSessionId: `unity:${selected.id}`,
    depth: 1,
    title: t.title,
    label: t.title,
    prompt: t.task,
    placement: "fresh",
    access: "read_write",
    execution: "parallel",
    dependsOnSessionId: null,
    reviewState: "pending",
    branch: null,
    pullRequestUrl: null,
    harnessId: "codex",
    listedModelId: "unity-preview",
    createdAt: t.messages[0]?.at ?? new Date().toISOString(),
    updatedAt: t.messages.at(-1)?.at ?? new Date().toISOString(),
    status:
      t.status === "running"
        ? "working"
        : t.status === "failed"
          ? "failed"
          : t.status === "waiting" || t.status === "paused"
            ? "waiting"
            : t.status === "ready"
              ? "done"
              : "draft",
    summary: t.status === "running" ? t.activity : t.summary,
  }));
  return (
    <div className="workspace-shell" data-projects-collapsed={!sidebarOpen}>
      <ProjectSidebar
        projects={projects}
        projectsLoading={false}
        selectedProjectId={selected.id}
        onSelectProject={switchProject}
        expanded={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onAddProject={() => setNewChat(true)}
        chats={workspace.projects.flatMap((p) => [
          {
            id: `unity:${p.id}`,
            projectId: p.id,
            title: "Unity",
            turnStatus: p.room.supervisorBusy
              ? ("running" as const)
              : ("idle" as const),
            harnessId: "codex" as const,
          },
          ...p.room.threads.map((t) => ({
            id: t.id,
            projectId: p.id,
            title: t.title,
            agentState:t.status,
            turnStatus:
              t.status === "running" ? ("running" as const) : ("idle" as const),
            harnessId: "codex" as const,
          })),
        ])}
        selectedChatId={chatId}
        hasUserMessage
        onSelectChat={(id) => {
          const p = workspace.projects.find(
            (p) =>
              id === `unity:${p.id}` || p.room.threads.some((t) => t.id === id),
          );
          if (p) setProjectId(p.id);
          setChatId(id);
          if (compact) setSidebarOpen(false);
        }}
        onNewChat={(id) => {
          if (id) switchProject(id);
          setNewChat(true);
        }}
        onOpenSettings={() =>
          setError(
            room.mode === "demo"
              ? "Demo mode uses simulated workers."
              : "Codex runs on Agent37. Each project has its own Unity supervisor.",
          )
        }
      />
      <main className="workspace-main">
        <button
          type="button"
          className="workspace-sidebar-toggle workspace-inspector-toggle"
          aria-label={
            inspectorOpen ? "Close right sidebar" : "Open right sidebar"
          }
          onClick={() => setInspectorOpen(!inspectorOpen)}
        >
          <PanelRight size={18} />
        </button>
        <WorkspacePanes
          open={inspectorOpen}
          compact={compact}
          ratio={ratio}
          view={view}
          layout="chat"
          onResize={setRatio}
          onReset={() => setRatio(0.58)}
        >
          <section
            className="welcome-panel"
            data-layout="chat"
            inert={compact && inspectorOpen}
            aria-hidden={compact && inspectorOpen}
          >
            <div className="session-title-row">
              <div className="session-title-copy">
                <span className="session-title">
                  {isUnity ? "Unity" : thread?.title}
                </span>
                <span className="session-title-meta">
                  {selected.name} ·{" "}
                  {room.mode === "demo"
                    ? "Demo"
                    : connected
                      ? "Live"
                      : "Reconnecting"}
                  {isUnity
                    ? ` · ${room.threads.filter((t) => t.status === "running").length} working · ${room.threads.filter((t) => t.question).length} need you`
                    : ""}
                </span>
              </div>
              {isUnity && (
                <button
                  className="project-unity-start"
                  onClick={() => perform("/api/demo-round")}
                >
                  New demo round
                </button>
              )}
              {isUnity && !room.activated && (
                <button
                  className="project-unity-start"
                  onClick={() => perform("/api/activate")}
                >
                  Start supervising
                </button>
              )}
            </div>
            {isUnity && room.threads.some((t) => t.status === "running") && (
              <div className="unity-live-work" role="status">
                {room.threads
                  .filter((t) => t.status === "running")
                  .map((t) => (
                    <p key={t.id}>
                      <span /> <strong>{t.title}</strong> —{" "}
                      {/node.*--test/.test(t.activity)
                        ? "Running checks"
                        : /\b(cat|sed|rg|ls)\b/.test(t.activity)
                          ? "Inspecting the implementation"
                          : t.activity.startsWith("/bin/")
                            ? "Updating the implementation"
                            : t.activity.length > 110
                              ? t.activity.slice(0, 110) + "…"
                              : t.activity}
                    </p>
                  ))}
              </div>
            )}
            <div className="welcome-content" data-layout="chat">
              <SessionLauncher
                key={chatId}
                session={session}
                busy={false}
                harnessId="codex"
                onHarnessIdChange={() => {}}
                onSend={(text) => {
                  if (isUnity) {
                    if (!room.activated) perform("/api/activate");
                    perform("/api/message", { text });
                  } else if (thread)
                    perform(`/api/threads/${thread.id}/control`, {
                      action: "message",
                      text,
                    });
                }}
                onConnect={() =>
                  setError("Connect Codex on your Agent37 instance.")
                }
                onStop={() =>
                  thread
                    ? perform(`/api/threads/${thread.id}/control`, {
                        action: "pause",
                      })
                    : setError("Tell Unity which chat to pause.")
                }
                onOpenInspector={openInspector}
                allowComparison={false}
                preserveMessages={isUnity}
                projects={projects}
                selectedProject={project}
                onSelectProject={switchProject}
                listedTitle={isUnity ? "Unity" : thread?.title}
                messageLabels={
                  isUnity
                    ? Object.fromEntries(
                        messages
                          .filter((m) => m.role === "assistant")
                          .map((m) => [
                            m.id,
                            <span className="unity-message-identity">
                              {m.sourceThreadId ? (
                                <button
                                  className="agent-identity-button"
                                  onClick={() => setChatId(m.sourceThreadId!)}
                                  aria-label={`Open ${room.threads.find((t) => t.id === m.sourceThreadId)?.title ?? "agent"} chat`}
                                >
                                  <AgentAvatar
                                    title={
                                      room.threads.find(
                                        (t) => t.id === m.sourceThreadId,
                                      )?.title ?? "Agent"
                                    }
                                  />
                                  <strong>
                                    {room.threads.find(
                                      (t) => t.id === m.sourceThreadId,
                                    )?.title ?? "Agent"}
                                  </strong>
                                </button>
                              ) : (
                                <span className="agent-identity-button">
                                  <AgentAvatar title="Unity" unity />
                                  <strong>Unity</strong>
                                </span>
                              )}
                              <time>
                                {new Date(m.at).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </time>
                            </span>,
                          ]),
                      )
                    : undefined
                }
              />
            </div>
          </section>
          <WorkspaceInspector
            collapsed={!inspectorOpen}
            activeView={view}
            onActiveViewChange={setView}
            fileChanges={[]}
            desktop={{ status: "stopped" }}
            desktopBusy={false}
            onStartDesktop={() =>
              setError("Worker environments run on Agent37.")
            }
            overview={
              <WorkspaceOverview
                tasks={tasks}
                items={session.items}
                changes={[]}
                pullRequests={[]}
                repository={project.fullName}
                desktop={{ status: "stopped" }}
                onOpen={openInspector}
              />
            }
          />
        </WorkspacePanes>
      </main>
      {error && (
        <div className="unity-notice" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss notice">
            <X size={16} />
          </button>
        </div>
      )}
      {newChat && (
        <div className="project-chat-dialog">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setCreating(true);
              try {
                await act(
                  "/api/threads",
                  {
                    title: String(data.get("title")),
                    task: String(data.get("task")),
                  },
                  selected.id,
                );
                setNewChat(false);
              } catch {
              } finally {
                setCreating(false);
              }
            }}
          >
            <header>
              New chat in {selected.name}
              <button
                type="button"
                onClick={() => setNewChat(false)}
                aria-label="Close new chat"
              >
                <X size={16} />
              </button>
            </header>
            <label>
              Name
              <input name="title" required />
            </label>
            <label>
              Task
              <textarea name="task" rows={4} required />
            </label>
            <button disabled={creating}>
              <Plus size={14} />
              {creating ? "Starting…" : "Start Codex chat"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
