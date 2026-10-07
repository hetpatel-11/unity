import { Check, ChevronRight, CircleAlert, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, type UIEvent, useEffect, useRef } from "react";
import { MatrixDotLoader } from "#/components/ui/matrix-dot-loader";
import type { AgentCompetition } from "#/domain/agent-competition";
import {
  type AgentTaskActivity,
  childTaskAnchorId,
  childTaskPublicItems,
} from "#/domain/child-task-activity";
import { commandActivityTitle } from "#/domain/command-activity-title";
import { fileChangeTotals } from "#/domain/diff-preview";
import {
  fileChangeActivity,
  fileChangeActivityTitle,
} from "#/domain/file-change-copy";
import { fileBasename } from "#/domain/file-kind";
import { listedModelDisplayName } from "#/domain/listed-model";
import { parseModelRouteId } from "#/domain/model-connection";
import { activityGlyphForToolName } from "#/domain/session-activity";
import {
  compactTimelineItems,
  type FileChangeEntry,
  fileChangesFromSessionItems,
  liveActivityStatus,
  type SessionItem,
  type SessionTurnStatus,
  showTurnWorking,
} from "#/domain/session-item";
import { thoughtLabel } from "#/domain/thought-label";
import {
  explorationGroupIsLive,
  explorationLabel,
  groupExplorationRows,
  groupTimelineRows,
  type TimelineRow,
} from "#/domain/timeline-activity";
import {
  toolCommand,
  toolDetailTitle,
  toolOutputText,
} from "#/domain/tool-detail";
import { ActivityIcon } from "./activity-icon";
import { AgentMarkdown } from "./agent-markdown";
import { FileChangeCounts } from "./file-change-counts";
import { FileMentionButton } from "./file-mention";
import { LiveCollapsible } from "./live-collapsible";
import { ShellCommandCode } from "./shell-command-code";
import { TodoList } from "./todo-list";

export function SessionTimeline({
  items,
  turnStatus,
  fill = false,
  onOpenFile,
  competitions = [],
  tasks = [],
  taskParentId,
  onOpenCandidate,
  autoScroll = true,
  collapseInstructions = false,
  recoveryControls,
  messageLabels,
  preserveMessages = false,
}: {
  recoveryControls?: (messageId: string) => ReactNode;
  messageLabels?: Record<string, ReactNode>;
  preserveMessages?: boolean;
  items: readonly SessionItem[];
  turnStatus: SessionTurnStatus;
  fill?: boolean;
  onOpenFile?: (path: string) => void;
  competitions?: readonly AgentCompetition[];
  tasks?: readonly AgentTaskActivity[];
  taskParentId?: string;
  onOpenCandidate?: (sessionId: string) => void;
  autoScroll?: boolean;
  collapseInstructions?: boolean;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const stickToEnd = useRef(true);
  const visible = compactTimelineItems(childTaskPublicItems(items));
  const candidateIds = new Set(
    competitions.flatMap((group) =>
      group.candidates.map((candidate) => candidate.id),
    ),
  );
  const childTasks = tasks.filter(
    (task) =>
      (taskParentId
        ? task.parentSessionId === taskParentId
        : task.depth === 1) && !candidateIds.has(task.id),
  );
  const rows: TimelineRow[] = preserveMessages
    ? visible.map((item) => ({ kind: "item", item }))
    : groupTimelineRows(visible, turnStatus);
  const fileChanges = fileChangesFromSessionItems(items);
  const currentTurnIds = new Set<SessionItem["id"]>();
  for (const item of visible) {
    if (item.kind === "userMessage") currentTurnIds.clear();
    else currentTurnIds.add(item.id);
  }

  useEffect(() => {
    if (!autoScroll || !stickToEnd.current) return;
    if (items.length === 0 && turnStatus !== "running") return;
    listRef.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [autoScroll, items, turnStatus]);

  function rememberScrollPin(event: UIEvent<HTMLOListElement>) {
    const list = event.currentTarget;
    stickToEnd.current =
      list.scrollHeight - list.scrollTop - list.clientHeight < 64;
  }

  if (
    visible.length === 0 &&
    childTasks.length === 0 &&
    turnStatus !== "running" &&
    !fill
  )
    return null;

  return (
    <ol
      ref={listRef}
      className="session-timeline"
      aria-label="Session"
      onScroll={rememberScrollPin}
    >
      {rows.map((row) => {
        const rowId = row.kind === "item" ? row.item.id : row.id;
        const attached =
          row.kind === "item" && row.item.kind === "userMessage"
            ? competitions.filter(
                (group) => group.userMessageId === row.item.id,
              )
            : [];
        return (
          <Fragment
            key={row.kind === "item" ? row.item.id : `${row.kind}:${row.id}`}
          >
            <li data-kind={row.kind === "item" ? row.item.kind : row.kind}>
              {row.kind === "item" && messageLabels?.[row.item.id] && (
                <div className="unity-message-meta">
                  {messageLabels[row.item.id]}
                </div>
              )}
              <TimelineRowView
                row={row}
                collapseInstructions={collapseInstructions}
                turnRunning={
                  turnStatus === "running" && currentTurnIds.has(rowId)
                }
                isLastItem={
                  (row.kind === "item" ? row.item.id : row.items.at(-1)?.id) ===
                  visible.at(-1)?.id
                }
                fileChanges={fileChanges}
                onOpenFile={onOpenFile}
              />
              {row.kind === "item" && row.item.kind === "userMessage"
                ? recoveryControls?.(row.item.id)
                : null}
            </li>
            {attached.map((group) => (
              <li key={group.id} data-kind="competition">
                <CompetitionTurn
                  group={group}
                  tasks={tasks}
                  onOpenCandidate={onOpenCandidate}
                />
              </li>
            ))}
            {childTasks
              .filter((task) => {
                const anchor = childTaskAnchorId(task, visible);
                return row.kind === "item"
                  ? anchor === row.item.id
                  : row.items.some((item) => item.id === anchor);
              })
              .map((task) => (
                <li key={`child:${task.id}`} data-kind="child-task">
                  <ChildTaskCard
                    task={task}
                    tasks={tasks}
                    onOpenFile={onOpenFile}
                  />
                </li>
              ))}
          </Fragment>
        );
      })}
      {childTasks
        .filter((task) => !childTaskAnchorId(task, visible))
        .map((task) => (
          <li key={`child:${task.id}`} data-kind="child-task">
            <ChildTaskCard task={task} tasks={tasks} onOpenFile={onOpenFile} />
          </li>
        ))}
      {!competitions.some((group) =>
        ["queued", "working"].includes(group.status),
      ) && showTurnWorking(items, turnStatus) ? (
        <li data-kind="working">
          <p className="session-working session-shimmer">Thinking</p>
        </li>
      ) : null}
      {turnStatus !== "running" &&
      childTasks.some((task) => task.turnStatus === "running") ? (
        <li data-kind="waiting-for-children">
          <p className="session-working" role="status">
            Waiting for child agents
          </p>
        </li>
      ) : null}
    </ol>
  );
}

function ChildTaskCard({
  task,
  tasks,
  onOpenFile,
}: {
  task: AgentTaskActivity;
  tasks: readonly AgentTaskActivity[];
  onOpenFile?: (path: string) => void;
}) {
  const children = tasks.filter((child) => child.parentSessionId === task.id);
  const busy = task.status === "working" || task.status === "waiting";
  const status =
    task.status === "done"
      ? task.reviewState === "pending"
        ? "Awaiting review"
        : "Completed"
      : task.status === "failed"
        ? "Failed"
        : task.status === "draft"
          ? "Planned"
          : busy
            ? "Working"
            : "Idle";
  const activity = childTaskPublicItems(task.items);
  return (
    <details className="child-task-card" data-status={task.status}>
      <summary>
        {busy ? (
          <MatrixDotLoader />
        ) : (
          <span className="child-task-card-icon" aria-hidden="true">
            {task.status === "done" ? (
              <Check size={14} />
            ) : task.status === "failed" ? (
              <CircleAlert size={14} />
            ) : (
              <Clock3 size={14} />
            )}
          </span>
        )}
        <span className="child-task-card-copy">
          <strong>{task.title}</strong>
          <small>
            {task.label}
            {task.listedModelId
              ? ` · ${listedModelDisplayName(parseModelRouteId(task.listedModelId)?.modelId ?? task.listedModelId)}`
              : ""}
          </small>
        </span>
        <span className="child-task-card-status">{status}</span>
        <ChevronRight
          className="competition-candidate-chevron"
          size={14}
          aria-hidden="true"
        />
      </summary>
      <div className="child-task-card-content">
        {activity.length ? (
          <SessionTimeline
            items={activity}
            turnStatus={task.turnStatus}
            onOpenFile={onOpenFile}
            autoScroll={false}
            collapseInstructions
          />
        ) : task.summary ? (
          <AgentMarkdown text={task.summary} onOpenFile={onOpenFile} />
        ) : (
          <p className="child-task-card-empty">
            {busy ? "Waiting for the first activity…" : "No activity yet."}
          </p>
        )}
        {children.map((child) => (
          <ChildTaskCard
            key={child.id}
            task={child}
            tasks={tasks}
            onOpenFile={onOpenFile}
          />
        ))}
      </div>
    </details>
  );
}

function CompetitionTurn({
  group,
  tasks,
  onOpenCandidate,
}: {
  group: AgentCompetition;
  tasks: readonly AgentTaskActivity[];
  onOpenCandidate?: (sessionId: string) => void;
}) {
  const candidatesFinished =
    group.candidates.length === group.leaderCount &&
    group.candidates.every((candidate) =>
      ["done", "failed"].includes(candidate.status),
    );
  return (
    <section
      className="competition-turn"
      aria-label={`${group.leaderCount} independent agents`}
    >
      <div className="competition-turn-heading">
        <span>{group.leaderCount} agents on this task</span>
        <small>
          {group.status === "judging"
            ? "Reviewing results"
            : group.status === "complete"
              ? "Review complete"
              : group.status === "failed"
                ? "Stopped"
                : "Working independently"}
        </small>
      </div>
      {[1, 2, 3, 4, 5].slice(0, group.leaderCount).map((agentNumber) => {
        const candidate = group.candidates.find(
          (item) => item.index === agentNumber,
        );
        const status = candidate?.status ?? "draft";
        const assignedModel = group.attemptModelIds?.[agentNumber - 1];
        const modelLabel = assignedModel
          ? listedModelDisplayName(
              parseModelRouteId(assignedModel)?.modelId ?? assignedModel,
            )
          : "";
        return (
          <details
            className="competition-candidate"
            key={`${group.id}-agent-${agentNumber}`}
          >
            <summary>
              {["working", "waiting"].includes(status) ? (
                <MatrixDotLoader />
              ) : (
                <span className="competition-agent-dot" data-status={status} />
              )}
              <span>{`Agent ${agentNumber}`}</span>
              {modelLabel ? (
                <span className="competition-candidate-model">
                  {modelLabel}
                </span>
              ) : null}
              <small className="competition-candidate-meta">
                {group.winnerSessionId === candidate?.id
                  ? "Selected"
                  : status === "done"
                    ? "Done"
                    : status === "failed"
                      ? "Failed"
                      : ["working", "waiting"].includes(status)
                        ? "Working"
                        : "Starting"}
              </small>
              <ChevronRight
                className="competition-candidate-chevron"
                size={14}
              />
            </summary>
            {candidate ? (
              <div className="competition-candidate-content">
                <SessionTimeline
                  tasks={tasks}
                  taskParentId={candidate.id}
                  items={candidate.items.filter(
                    (item) => item.kind !== "userMessage",
                  )}
                  turnStatus={
                    ["working", "waiting"].includes(status)
                      ? "running"
                      : status === "done"
                        ? "completed"
                        : status === "failed"
                          ? "failed"
                          : "idle"
                  }
                  fill
                  autoScroll={false}
                />
                {candidate.summary ? <p>{candidate.summary}</p> : null}
                {onOpenCandidate ? (
                  <button
                    type="button"
                    onClick={() => onOpenCandidate(candidate.id)}
                  >
                    Inspect workspace
                  </button>
                ) : null}
              </div>
            ) : null}
          </details>
        );
      })}
      {candidatesFinished && ["judging", "complete"].includes(group.status) ? (
        <p className="competition-judge">
          {group.status === "judging" ? <MatrixDotLoader /> : null}
          <span>
            {group.status === "judging"
              ? "Judge reviewing results"
              : group.winnerSessionId
                ? `Judge selected Agent ${group.candidates.find((candidate) => candidate.id === group.winnerSessionId)?.index ?? ""}`
                : "Judge finished without a selection"}
          </span>
        </p>
      ) : null}
      {group.errorMessage ? (
        <p className="competition-error">{group.errorMessage}</p>
      ) : null}
    </section>
  );
}

function TimelineRowView({
  row,
  collapseInstructions = false,
  turnRunning,
  isLastItem,
  fileChanges,
  onOpenFile,
}: {
  row: TimelineRow;
  collapseInstructions?: boolean;
  turnRunning: boolean;
  isLastItem: boolean;
  fileChanges: readonly FileChangeEntry[];
  onOpenFile?: (path: string) => void;
}) {
  if (row.kind === "work") {
    return (
      <details className="session-work">
        <summary>
          <span title="Elapsed time from dispatch to observed completion">
            {row.label}
          </span>
          <ChevronRight size={12} className="session-activity-chevron" />
        </summary>
        <div className="session-work-items">
          {groupExplorationRows(row.items).map((child) => (
            <TimelineRowView
              key={child.kind === "item" ? child.item.id : child.id}
              row={child}
              turnRunning={false}
              isLastItem={false}
              fileChanges={fileChanges}
              onOpenFile={onOpenFile}
            />
          ))}
        </div>
      </details>
    );
  }
  if (row.kind === "exploration") {
    const live = turnRunning && explorationGroupIsLive(row.items);
    return (
      <LiveCollapsible
        className="session-exploration"
        data-live={live ? "true" : undefined}
        live={live}
      >
        <summary>
          <span
            className={
              live
                ? "session-activity-title session-shimmer"
                : "session-activity-title"
            }
          >
            {explorationLabel(row.counts)}
          </span>
          <ChevronRight size={12} className="session-activity-chevron" />
        </summary>
        {row.items.map((item) => (
          <SessionItemView
            key={item.id}
            item={item}
            nested
            turnRunning={turnRunning}
            fileChanges={fileChanges}
            onOpenFile={onOpenFile}
          />
        ))}
      </LiveCollapsible>
    );
  }
  return (
    <SessionItemView
      item={row.item}
      collapseInstructions={collapseInstructions}
      thoughtInProgress={turnRunning && isLastItem}
      turnRunning={turnRunning}
      fileChanges={fileChanges}
      onOpenFile={onOpenFile}
    />
  );
}

function SessionItemView({
  item,
  collapseInstructions = false,
  nested = false,
  thoughtInProgress = false,
  turnRunning = false,
  fileChanges,
  onOpenFile,
}: {
  item: SessionItem;
  collapseInstructions?: boolean;
  nested?: boolean;
  thoughtInProgress?: boolean;
  turnRunning?: boolean;
  fileChanges: readonly FileChangeEntry[];
  onOpenFile?: (path: string) => void;
}) {
  const live = activityTitleIsLive(item, turnRunning, thoughtInProgress);
  const titleClass = live
    ? "session-activity-title session-shimmer"
    : "session-activity-title";
  switch (item.kind) {
    case "userMessage":
      if (collapseInstructions) {
        return (
          <details className="session-work child-task-instructions">
            <summary>
              <span>Task instructions</span>
              <ChevronRight size={12} className="session-activity-chevron" />
            </summary>
            <div className="session-work-items">
              <AgentMarkdown text={item.text} onOpenFile={onOpenFile} />
            </div>
          </details>
        );
      }
      return (
        <div className="session-message" data-role="user">
          <p>{item.text}</p>
        </div>
      );
    case "agentMessage":
      return (
        <div
          className="session-message"
          data-role="assistant"
          data-streaming={turnRunning && item.streaming ? "true" : undefined}
        >
          <AgentMarkdown
            text={item.text}
            streaming={Boolean(turnRunning && item.streaming)}
            fileChanges={fileChanges}
            onOpenFile={onOpenFile}
          />
        </div>
      );
    case "reasoning": {
      const summaries = item.summaries.filter((summary) => summary.trim());
      const title = thoughtLabel({
        durationSeconds: item.durationSeconds,
        inProgress: live,
      });
      if (summaries.length === 0) {
        if (!live) return null;
        return (
          <div
            className="session-activity"
            data-kind="reasoning"
            data-live={live ? "true" : undefined}
          >
            <p>
              <span className={titleClass}>{title}</span>
            </p>
          </div>
        );
      }
      return (
        <LiveCollapsible
          className="session-activity"
          data-kind="reasoning"
          data-live={live ? "true" : undefined}
          live={live}
        >
          <summary>
            <span className={titleClass}>
              {summaries[0]?.split("\n")[0].replace(/^#+\s*|\*\*/g, "") ||
                title}
            </span>
            <ChevronRight size={12} className="session-activity-chevron" />
          </summary>
          {summaries.map((summary) => (
            <p key={`${item.id}:${summary}`}>{summary}</p>
          ))}
        </LiveCollapsible>
      );
    }
    case "plan":
      if (item.todos) return <TodoList todos={item.todos} />;
      return (
        <details className="session-activity" data-kind="plan">
          <summary>
            <ActivityIcon glyph="plan" />
            <span className="session-activity-title">Plan</span>
            <ChevronRight size={12} className="session-activity-chevron" />
          </summary>
          <p>{item.text || "Planning…"}</p>
        </details>
      );
    case "commandExecution": {
      const status = activityStatusLabel(item.status);
      return (
        <details
          className="session-activity"
          data-kind="commandExecution"
          data-status={item.status}
          data-live={live ? "true" : undefined}
        >
          <summary>
            <span className={titleClass}>
              {commandActivityTitle(item.command)}
            </span>
            {status ? (
              <span className="session-activity-status">{status}</span>
            ) : null}
            <ChevronRight size={12} className="session-activity-chevron" />
          </summary>
          <div className="session-command-detail">
            <ShellCommandCode command={item.command} />
            {item.output ? (
              <pre className="session-output">{item.output}</pre>
            ) : null}
            {item.exitCode !== null ? (
              <p className="session-activity-meta">exit {item.exitCode}</p>
            ) : null}
          </div>
        </details>
      );
    }
    case "fileChange": {
      const totals = fileChangeTotals(item.changes);
      const title = fileChangeActivityTitle(item.changes);
      const status = activityStatusLabel(item.status);
      const counts = (
        <FileChangeCounts
          additions={totals.additions}
          deletions={totals.deletions}
        />
      );
      const progress = status ? (
        <span className="session-activity-status">{status}</span>
      ) : null;
      if (item.changes.length === 0) return null;
      if (item.changes.length === 1) {
        const activity = fileChangeActivity(item.changes);
        const change = item.changes[0];
        return (
          <div
            className="session-activity"
            data-kind="fileChange"
            data-status={item.status}
            data-live={live ? "true" : undefined}
            data-nested={nested ? "true" : undefined}
          >
            <p>
              <ActivityIcon glyph="edit" />
              <span className={titleClass}>
                {activity.verb}{" "}
                {change && activity.name ? (
                  <FileMentionButton
                    path={change.path}
                    name={activity.name}
                    change={change.change}
                    onOpenFile={onOpenFile}
                  />
                ) : (
                  "1 file"
                )}
              </span>
              {counts}
              {progress}
            </p>
          </div>
        );
      }
      return (
        <details
          className="session-activity"
          data-kind="fileChange"
          data-status={item.status}
          data-live={live ? "true" : undefined}
          data-nested={nested ? "true" : undefined}
          open
        >
          <summary>
            <ActivityIcon glyph="edit" />
            <span className={titleClass}>{title}</span>
            {counts}
            <ChevronRight size={12} className="session-activity-chevron" />
            {progress}
          </summary>
          {item.changes.map((change) => (
            <p className="session-file-change-row" key={change.path}>
              <FileMentionButton
                path={change.path}
                name={fileBasename(change.path)}
                change={change.change}
                onOpenFile={onOpenFile}
              />
              <FileChangeCounts
                additions={change.additions}
                deletions={change.deletions}
              />
            </p>
          ))}
        </details>
      );
    }
    case "mcpToolCall":
      return (
        <div
          className="session-activity"
          data-kind="mcpToolCall"
          data-status={item.status}
          data-live={live ? "true" : undefined}
        >
          <p>
            <ActivityIcon glyph="mcp" />
            <span className={titleClass}>
              {item.server} · {item.tool}
            </span>
            {activityStatus(item.status)}
          </p>
        </div>
      );
    case "dynamicToolCall": {
      const command = toolCommand(item);
      return (
        <details
          className="session-activity"
          data-kind="dynamicToolCall"
          data-status={item.status}
          data-live={live ? "true" : undefined}
          data-nested={nested ? "true" : undefined}
        >
          <summary>
            <ActivityIcon glyph={activityGlyphForToolName(item.tool)} />
            <span className={titleClass}>{toolDetailTitle(item)}</span>
            <ChevronRight size={12} className="session-activity-chevron" />
            {activityStatus(item.status)}
          </summary>
          {item.input && (
            <div className="session-command-detail">
              <p className="session-activity-meta">Input</p>
              {command ? (
                <ShellCommandCode command={command} />
              ) : (
                <pre className="session-output">{item.input}</pre>
              )}
            </div>
          )}
          {item.output && (
            <div className="session-command-detail">
              <p className="session-activity-meta">Result</p>
              <pre className="session-output">
                {toolOutputText(item.output)}
              </pre>
            </div>
          )}
          {!item.input && !item.output && (
            <p>Details were not recorded for this older call.</p>
          )}
        </details>
      );
    }
    case "webSearch":
      return (
        <div
          className="session-activity"
          data-kind="webSearch"
          data-nested={nested ? "true" : undefined}
        >
          <p>
            <ActivityIcon glyph="web" />
            <span className="session-activity-title">
              {item.query ? item.query : "Search"}
            </span>
          </p>
        </div>
      );
    case "error":
      return (
        <div className="session-activity" data-kind="error" role="alert">
          <p>
            <ActivityIcon glyph="error" />
            <span className="session-activity-title">{item.message}</span>
          </p>
        </div>
      );
    case "unknown":
      return (
        <div
          className="session-activity"
          data-kind="unknown"
          data-nested={nested ? "true" : undefined}
        >
          <p>
            <ActivityIcon glyph={activityGlyphForToolName(item.type)} />
            <span className="session-activity-title">{item.type}</span>
          </p>
        </div>
      );
  }
}

function activityStatus(status: string) {
  const label = activityStatusLabel(status);
  return label ? (
    <span className="session-activity-status">{label}</span>
  ) : null;
}

function activityTitleIsLive(
  item: SessionItem,
  turnRunning: boolean,
  thoughtInProgress: boolean,
): boolean {
  if (item.kind === "reasoning") {
    return turnRunning && thoughtInProgress && item.durationSeconds == null;
  }
  return turnRunning && liveActivityStatus(item) === "inProgress";
}

function activityStatusLabel(status: string): string | null {
  if (status === "failed") return "Failed";
  if (status === "declined") return "Declined";
  return null;
}
