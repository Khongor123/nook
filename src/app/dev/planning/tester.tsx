"use client";

import { useState } from "react";
import type { PrivateAssignmentDetail, ShelfCard } from "@/lib/types";

type EditableStep = {
  id?: string;
  text: string;
  minutes: number;
  done: boolean;
  source: "suggested" | "student";
};
type Draft = {
  steps: { text: string; minutes: number }[];
  effortMinMinutes?: number;
  effortMaxMinutes?: number;
  needsReview: boolean;
  note: string;
};

export default function PlanningTester() {
  const [cards, setCards] = useState<ShelfCard[]>([]);
  const [id, setId] = useState("");
  const [detail, setDetail] = useState<PrivateAssignmentDetail | null>(null);
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [minMinutes, setMinMinutes] = useState(60);
  const [maxMinutes, setMaxMinutes] = useState(90);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function read(response: Response) {
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Request failed");
    return data;
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }

  async function loadDetail(assignmentId: string) {
    const data: PrivateAssignmentDetail = await read(await fetch(`/api/private/assignments/${assignmentId}`));
    setDetail(data);
    setSteps(data.steps.map((step) => ({
      id: step.id,
      text: step.text,
      minutes: step.minutes,
      done: step.done,
      source: step.source,
    })));
    setMinMinutes(data.effortEstimate?.minMinutes ?? 60);
    setMaxMinutes(data.effortEstimate?.maxMinutes ?? 90);
  }

  function updateStep(index: number, patch: Partial<EditableStep>) {
    setSteps((current) => current.map((step, position) => position === index ? { ...step, ...patch } : step));
  }

  return <main className="mx-auto max-w-xl space-y-5 px-5 py-10">
    <h1 className="text-2xl font-semibold">Planning integration check</h1>
    <p>Development-only. Sign in first, sync a Canvas course or create the fictional assignment, then test the saved plan.</p>
    <button className="rounded-lg bg-amber-200 px-4 py-3 disabled:opacity-50" disabled={busy}
      onClick={() => run(async () => {
        const data: ShelfCard[] = await read(await fetch("/api/private/shelf"));
        setCards(data);
        setMessage(data.length ? "Select an assignment." : "Your private shelf is empty.");
      })}>1. Load shelf</button>

    {cards.length > 0 && <div className="space-y-2">
      <label htmlFor="assignment" className="block font-semibold">Assignment</label>
      <select id="assignment" className="w-full rounded-lg border p-3" value={id}
        onChange={(event) => { setId(event.target.value); setDetail(null); }}>
        <option value="">Choose one</option>
        {cards.map((card) => <option key={card.assignment.id} value={card.assignment.id}>{card.assignment.courseName}: {card.assignment.title}</option>)}
      </select>
      <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy || !id}
        onClick={() => run(async () => { await loadDetail(id); setMessage("Saved plan loaded."); })}>2. Load assignment</button>
    </div>}

    {detail && <>
      <div className="rounded-xl border p-4">
        <h2 className="font-semibold">{detail.assignment.title}</h2>
        <p>Canvas due: {detail.assignment.dueAt ? new Date(detail.assignment.dueAt).toLocaleString() : "No date"}</p>
        <p>Start-by: {cards.find((card) => card.assignment.id === id)?.startByReason ?? "Refresh the shelf after saving"}</p>
        <p>{detail.welcomeBack.message}</p>
        <p>Next: {detail.welcomeBack.nextAction}</p>
        {detail.welcomeBack.ideaText && <p>Idea: {detail.welcomeBack.ideaText}</p>}
      </div>
      <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy}
        onClick={() => run(async () => {
          const draft: Draft = await read(await fetch(`/api/private/assignments/${id}/breakdown`, { method: "POST" }));
          if (draft.steps.length) {
            setSteps(draft.steps.map((step) => ({ ...step, done: false, source: "suggested" })));
            setMinMinutes(draft.effortMinMinutes ?? 60);
            setMaxMinutes(draft.effortMaxMinutes ?? 90);
          }
          setMessage(draft.steps.length ? `Editable draft ready. ${draft.note}` : "AI draft unavailable. Add a manual step below.");
        })}>3. Generate editable draft</button>
      <section className="space-y-3">
        <h2 className="font-semibold">Review and edit the plan</h2>
        <div className="flex gap-3">
          <label>Minimum minutes<input className="w-full rounded-lg border p-2" type="number" min="10" max="2400" value={minMinutes}
            onChange={(event) => setMinMinutes(Number(event.target.value))} /></label>
          <label>Maximum minutes<input className="w-full rounded-lg border p-2" type="number" min="10" max="3000" value={maxMinutes}
            onChange={(event) => setMaxMinutes(Number(event.target.value))} /></label>
        </div>
        {steps.map((step, index) => <div key={step.id ?? `new-${index}`} className="space-y-2 rounded-lg border p-3">
          <input aria-label={`Step ${index + 1} text`} className="w-full rounded border p-2" value={step.text}
            onChange={(event) => updateStep(index, { text: event.target.value })} />
          <div className="flex items-center gap-3">
            <input aria-label={`Step ${index + 1} minutes`} className="w-20 rounded border p-2" type="number" min="10" max="480" value={step.minutes}
              onChange={(event) => updateStep(index, { minutes: Number(event.target.value) })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={step.done}
              onChange={(event) => updateStep(index, { done: event.target.checked })} />Done</label>
            <button className="underline" onClick={() => setSteps((current) => current.filter((_, position) => position !== index))}>Remove</button>
          </div>
        </div>)}
        <button className="rounded-lg border px-4 py-2" disabled={steps.length >= 6}
          onClick={() => setSteps((current) => [...current, { text: "", minutes: 30, done: false, source: "student" }])}>Add manual step</button>
      </section>
      <button className="rounded-lg bg-amber-200 px-4 py-3 disabled:opacity-50" disabled={busy || steps.length === 0}
        onClick={() => run(async () => {
          await read(await fetch(`/api/private/assignments/${id}/plan`, {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ effortMinMinutes: minMinutes, effortMaxMinutes: maxMinutes, steps }),
          }));
          await loadDetail(id);
          const data: ShelfCard[] = await read(await fetch("/api/private/shelf"));
          setCards(data);
          setMessage("Plan saved. Refresh this page and load the assignment again to check persistence.");
        })}>4. Save reviewed plan</button>
    </>}
    <p role="status">{message}</p>
  </main>;
}
