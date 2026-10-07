import { useEffect, useState } from "react";
import { unityWorkspaceSchema, type UnityWorkspace } from "#/domain/unity";
export async function unityAction(
  path: string,
  body: unknown = {},
  projectId?: string,
) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(projectId ? { "X-Unity-Project-Id": projectId } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Action failed");
  return data;
}
export function useRoom() {
  const [locked, setLocked] = useState<boolean | null>(null);
  const [workspace, setWorkspace] = useState<UnityWorkspace>();
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function connect() {
      try {
        const response = await fetch("/api/access");
        if (!response.ok) throw new Error("Unavailable");
        const access = await response.json();
        if (!disposed) {
          setLocked(access.locked);
          setError("");
        }
      } catch {
        if (!disposed) {
          setError("Reconnecting to Unity…");
          timer = setTimeout(connect, 1500);
        }
      }
    }
    void connect();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, []);
  useEffect(() => {
    if (locked !== false) return;
    let disposed = false;
    const stream = new EventSource("/api/workspace/events");
    stream.onmessage = (event) => {
      try {
        if (!disposed) {
          setWorkspace(unityWorkspaceSchema.parse(JSON.parse(event.data)));
          setConnected(true);
        }
      } catch {
        setError("The server sent an invalid room update.");
      }
    };
    stream.onerror = () => setConnected(false);
    return () => {
      disposed = true;
      stream.close();
    };
  }, [locked]);
  async function act(path: string, body: unknown = {}, projectId?: string) {
    try {
      setError("");
      return await unityAction(path, body, projectId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
      throw cause;
    }
  }
  async function unlock(token: string) {
    await act("/api/login", { token });
    setLocked(false);
  }
  return { workspace, connected, error, setError, act, locked, unlock };
}
