"use client";

import { useState } from "react";

type Course = { id: string; name: string; timeZone: string };
type Result = { imported: number; updated: number; failures: { courseId: string; message: string }[]; syncedAt: string };

export default function CanvasTester() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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

  async function read(response: Response) {
    const data = await response.json();
    if (!response.ok && response.status !== 207) throw new Error(data.message ?? "Request failed");
    return data;
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 px-5 py-10">
      <h1 className="text-2xl font-semibold">Canvas import check</h1>
      <p>Development-only. Sign in with the presenter account, then load courses, choose one, and sync. Your Canvas token stays on the server.</p>
      <button className="rounded-lg bg-amber-200 px-4 py-3 disabled:opacity-50" disabled={busy}
        onClick={() => run(async () => {
          const data: Course[] = await read(await fetch("/api/private/canvas/courses"));
          setCourses(data);
          setMessage(data.length ? "Choose courses to import." : "Canvas returned no active student courses.");
        })}
      >1. Load my courses</button>
      {courses.length > 0 && <section className="space-y-2">
        <h2 className="font-semibold">Courses</h2>
        {courses.map((course) => <label key={course.id} className="flex gap-3 rounded-lg border p-3">
          <input type="checkbox" checked={selected.includes(course.id)} onChange={(event) =>
            setSelected((current) => event.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id))
          } />
          <span>{course.name}</span>
        </label>)}
      </section>}
      <button className="rounded-lg border px-4 py-3 disabled:opacity-50" disabled={busy || selected.length === 0}
        onClick={() => run(async () => {
          const data: Result = await read(await fetch("/api/private/canvas/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ courseIds: selected }),
          }));
          setResult(data);
          setMessage("Sync finished. Repeat it to check that assignments update without duplicates.");
        })}
      >2. Sync selected courses</button>
      <p role="status">{message}</p>
      {result && <section className="rounded-xl border p-4">
        <p>Imported: {result.imported}. Updated: {result.updated}.</p>
        <p>Finished: {new Date(result.syncedAt).toLocaleString()}</p>
        {result.failures.map((failure) => <p key={failure.courseId}>Course {failure.courseId}: {failure.message}</p>)}
        <a className="underline" href="/api/private/shelf" target="_blank" rel="noreferrer">View private shelf JSON</a>
      </section>}
    </main>
  );
}
