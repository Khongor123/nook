"use client";

import { useState } from "react";
import type { AssignmentDetail, ShelfCard } from "@/lib/types";

export default function PersistenceTester() {
  const [assignmentId, setAssignmentId] = useState("");
  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function request(path: string, method = "GET", body?: object) {
    const response = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message ?? "Request failed");
    return result;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  function load() {
    return run(async () => {
      let id = assignmentId;
      if (!id) {
        const cards: ShelfCard[] = await request("/api/private/shelf");
        id = cards.find((card) =>
          card.assignment.canvasAssignmentId === "demo-canvas-essay"
        )?.assignment.id ?? "";
        if (!id) throw new Error("Create the fictional assignment first.");
        setAssignmentId(id);
      }
      const result = await request(`/api/private/assignments/${id}`);
      setDetail(result);
      setMessage("Loaded saved assignment data.");
    });
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-10">
      <h1 className="text-2xl font-semibold">Private data check</h1>
      <p>This development-only page uses fictional coursework. Sign in first. After step 4, refresh the browser and press step 5 to prove the data survived.</p>
      <button
        className="rounded-lg bg-amber-200 px-4 py-3 disabled:opacity-50"
        disabled={busy}
        onClick={() => run(async () => {
          const result = await request("/api/private/demo-seed", "POST");
          setAssignmentId(result.assignmentId);
          setMessage("Fictional assignment created. Save a thought next.");
        })}
      >
        1. Create fictional assignment
      </button>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy || !assignmentId}
          onClick={() => run(async () => {
            await request(`/api/private/assignments/${assignmentId}/thoughts`, "POST", {
              kind: "idea", text: "Open the essay with a question.",
            });
            setMessage("Idea saved.");
          })}
        >2. Save an Idea</button>
        <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy || !assignmentId}
          onClick={() => run(async () => {
            await request(`/api/private/assignments/${assignmentId}/thoughts`, "POST", {
              kind: "reflection", text: "I feel unsure about the introduction.",
            });
            setMessage("Reflection saved as a note.");
          })}
        >3. Save a Reflection</button>
        <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy || !assignmentId}
          onClick={() => run(async () => {
            await request(`/api/private/assignments/${assignmentId}/checkpoints`, "POST", {
              note: "I chose a topic.", nextStep: "Draft an opening line.",
            });
            setMessage("Checkpoint saved.");
          })}
        >4. Save a checkpoint</button>
        <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy}
          onClick={() => load()}
        >5. Reload saved data</button>
      </div>
      <p role="status">{message}</p>
      {assignmentId && <p className="break-all text-sm">Assignment ID: {assignmentId}</p>}
      {detail && (
        <div className="rounded-xl border p-4">
          <h2 className="font-semibold">{detail.assignment.title}</h2>
          <p>Ideas: {detail.thoughts.filter((item) => item.kind === "idea").length}</p>
          <p>Reflections: {detail.thoughts.filter((item) => item.kind === "reflection").length}</p>
          <p>Latest checkpoint: {detail.latestCheckpoint?.note ?? "None"}</p>
        </div>
      )}
    </main>
  );
}
