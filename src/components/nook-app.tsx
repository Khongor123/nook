"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PrivateAssignmentDetail, ShelfCard, Step, ThoughtKind, EffortResult } from "@/lib/types";
import { sortByImportance } from "@/lib/planning/importance";
import { estimateBatch } from "@/lib/planning/estimate-batch";
import { estimateHourRange } from "@/lib/effort";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Check, Leaf, Library, Lock, PenLine, RefreshCw, Trash2 } from "lucide-react";
import { demoAssignments } from "@/lib/demo-fixtures";
import { demoStore, demoFlag, setDemoFlag } from "@/lib/demo-state";

type Screen = "welcome" | "sign-in" | "sign-up" | "connect" | "coming-later" | "import" | "shelf" | "assignment" | "current" | "checkpoint" | "welcome-back";
type Course = { id: string; name: string; lastSyncedAt: string | null; selected: boolean };
type DraftStep = Pick<Step, "text" | "minutes" | "done" | "source"> & { id?: string };
type Draft = { steps: { text: string; minutes: number }[]; effortMinMinutes?: number; effortMaxMinutes?: number; needsReview: boolean; note: string };
type ApiError = { code?: string; message?: string; retryable?: boolean };
const ACTIVE_KEY = "nook-active-assignment";
const DEMO_MODE_KEY = "nook-demo-mode";
const DEMO_COURSES_KEY = "nook-demo-courses";
const demoCourses: Course[] = [...new Map(demoAssignments.map(a => [a.canvasCourseId, { id: a.canvasCourseId, name: a.courseName, selected: true, lastSyncedAt: null }])).values()];
function isDemoMode() { return demoFlag(DEMO_MODE_KEY) === "true"; }
function selectedDemoCourses(): string[] {
  try { const ids: unknown = JSON.parse(demoFlag(DEMO_COURSES_KEY) || "null"); if (Array.isArray(ids) && ids.every(id => typeof id === "string")) return ids; } catch { /* Use all fictional courses. */ }
  return demoCourses.map(c => c.id);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { cache: "no-store", ...init }); }
  catch { throw new Error("Could not connect. Check your connection and try again."); }
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = data as ApiError;
    const error = new Error(problem.message || "Something went wrong. Please try again.") as Error & { code?: string; status?: number };
    error.code = problem.code; error.status = response.status; throw error;
  }
  return data as T;
}
type EffortReply = EffortResult | { unchanged: true; sourceHash: string };
const pendingEffortRequests = new Map<string, Promise<EffortReply>>();
async function requestEffort(path: string, headers: Record<string, string>) {
  const key = JSON.stringify([path, headers]);
  const pending = pendingEffortRequests.get(key) ?? request<EffortReply>(path, { method: "POST", headers, signal: AbortSignal.timeout(50000) });
  pendingEffortRequests.set(key, pending);
  try { return await pending; }
  finally { if (pendingEffortRequests.get(key) === pending) pendingEffortRequests.delete(key); }
}

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Please try again."; }
function code(error: unknown) { return (error as { code?: string })?.code; }
function date(value: string | null, options?: Intl.DateTimeFormatOptions) { if (!value) return "No due date"; return new Intl.DateTimeFormat("en-US", options ?? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } } };
function Button({ children, href, onClick, variant = "dark", disabled, type = "button" }: { children: ReactNode; href?: string; onClick?: () => void; variant?: "dark" | "peach" | "outline" | "muted"; disabled?: boolean; type?: "button" | "submit" }) { const cls = `button button-${variant}`; return href ? <Link className={cls} href={href}>{children}</Link> : <button className={cls} onClick={onClick} disabled={disabled} type={type}>{children}</button>; }
function Frame({ children, footer, className = "", showNav = false, activeId }: { children: ReactNode; footer?: ReactNode; className?: string; showNav?: boolean; activeId?: string }) {
  return <div className={`phone ${className}`}>
    <motion.main className="phone-content" variants={rise} initial="hidden" animate="show">{children}</motion.main>
    {footer ?? (showNav ? <BottomBar active="shelf" id={activeId}/> : null)}
  </div>;
}
function BottomBar({ active, id, allowedIds }: { active: "shelf" | "current"; id?: string; allowedIds?: string[] }) {
  const [target, setTarget] = useState(id || "");
  const allowedKey = allowedIds?.join("|");
  useEffect(() => { void Promise.resolve().then(() => {
    const saved = id || demoFlag(ACTIVE_KEY) || "";
    setTarget(allowedKey !== undefined && !allowedKey.split("|").includes(saved) ? "" : saved);
  }); }, [id, allowedKey]);
  return <nav className="bottom-bar" aria-label="Main navigation"><Link className={active === "shelf" ? "selected" : ""} href="/shelf"><Library size={18} strokeWidth={2.4}/> Shelf</Link><Link className={active === "current" ? "selected" : ""} href={target ? `/current/${target}` : "/shelf"}><PenLine size={18} strokeWidth={2.4}/> Current work</Link></nav>;
}
function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) { return <p className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</p>; }
function Panel({ children, tone = "lavender", className = "" }: { children: ReactNode; tone?: "lavender" | "peach" | "mint"; className?: string }) { return <div className={`panel panel-${tone} ${className}`}>{children}</div>; }
function IconCircle() { return <span className="icon-circle" aria-hidden="true"><Leaf size={20} strokeWidth={2.3}/></span>; }

export default function NookApp({ screen, id }: { screen: Screen; id?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [syncNote, setSyncNote] = useState("");
  const [cards, setCards] = useState<ShelfCard[]>([]);
  const [shelfPage, setShelfPage] = useState(0);
  const [estimation, setEstimation] = useState<{ completed: number; total: number } | null>(null);
  const shelfRun = useRef(0);
  const invalidateShelf = useCallback(() => { shelfRun.current++; }, []);
  const [startCard, setStartCard] = useState<ShelfCard | null>(null);
  const [detail, setDetail] = useState<PrivateAssignmentDetail | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([]);
  const [effortMinHours, setEffortMinHours] = useState(1);
  const [effortMaxHours, setEffortMaxHours] = useState(2);
  const [draftNote, setDraftNote] = useState("");
  const [thoughtKind, setThoughtKind] = useState<ThoughtKind>("idea");
  const [thoughtText, setThoughtText] = useState("");
  const [checkpointNote, setCheckpointNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [editingNext, setEditingNext] = useState(false);
  const revision = useRef(0);
  const generation = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentId = useRef(id);
  const invalidateGeneration = useCallback(() => { generation.current++; }, []);
  function flushDemo() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    try { demoStore.flush(); setError(""); setInfo(""); return true; }
    catch (e) { setError(message(e)); return false; }
  }
  function stagePlan(plan: DraftStep[], min = effortMinHours, max = effortMaxHours) {
    setSteps(plan); revision.current++;
    if (!id || !isDemoMode()) return;
    const minMinutes = Math.round(min * 60), maxMinutes = Math.round(max * 60);
    const effortEstimate = minMinutes >= 10 && maxMinutes >= minMinutes ? { minMinutes, maxMinutes } : null;
    const savedSteps = plan.map(step => ({ ...step, id: step.id || crypto.randomUUID(), assignmentId: id }));
    demoStore.patch(id, { steps: savedSteps, effortEstimate }, false);
    setStartCard(demoStore.shelf(id));
    setInfo("");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushDemo, 400);
  }
  useEffect(() => {
    currentId.current = id;
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current); saveTimer.current = null;
        try { demoStore.flush(); } catch { /* In-memory edits remain; next screen shows the warning. */ }
      }
    };
    window.addEventListener("pagehide", flush);
    return () => { invalidateGeneration(); flush(); window.removeEventListener("pagehide", flush); };
  }, [id, screen, invalidateGeneration]);


  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError("");
    try {
      if (isDemoMode()) {
        const value = demoStore.detail(id);
        setDetail(value); setSteps(value.steps);
        const range = value.effortEstimate ? estimateHourRange({ steps: value.steps, effortMinMinutes: value.effortEstimate.minMinutes, effortMaxMinutes: value.effortEstimate.maxMinutes }) : { min: 0, max: 0 };
        setEffortMinHours(range.min); setEffortMaxHours(range.max);
        const saved = demoStore.get(id);
        setDraftNote(saved.draftNote ? `AI-generated suggestion · editable. ${saved.needsReview ? "Review needed. " : ""}${saved.draftNote}` : "");
        setStartCard(demoStore.shelf(id));
        if (demoStore.warning()) setError(demoStore.warning());
        setDemoFlag(ACTIVE_KEY, id); return;
      }
      const value = await request<PrivateAssignmentDetail>(`/api/private/assignments/${id}`);
      setDetail(value); setSteps(value.steps.map(s => ({ id: s.id, text: s.text, minutes: s.minutes, done: s.done, source: s.source })));
      setEffortMinHours(Math.max(1, Math.round((value.effortEstimate?.minMinutes ?? 60) / 60)));
      setEffortMaxHours(Math.max(1, Math.round((value.effortEstimate?.maxMinutes ?? 120) / 60)));
      if (screen === "assignment") request<ShelfCard[]>("/api/private/shelf").then(all => setStartCard(all.find(card => card.assignment.id === id) ?? null)).catch(() => {});
      setDemoFlag(ACTIVE_KEY, id);
    } catch (e) { if (code(e) === "UNAUTHORIZED") router.replace("/sign-in"); else setError(message(e)); }
    finally { setLoading(false); }
  }, [id, router, screen]);

  const loadCourses = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (isDemoMode()) {
        const selectedIds = selectedDemoCourses();
        setCourses(demoCourses); setSelected(selectedIds); return;
      }
      const value = await request<Course[]>("/api/private/canvas/courses");
      setCourses(value); setSelected(value.filter(c => c.selected).map(c => c.id));
    } catch (e) {
      if (code(e) === "UNAUTHORIZED") router.replace("/sign-in");
      else if (code(e) === "CANVAS_NOT_AVAILABLE") router.replace("/coming-later");
      else setError(message(e));
    } finally { setLoading(false); }
  }, [router]);

  const loadShelf = useCallback(async (retry = false) => {
    const ticket = ++shelfRun.current;
    setLoading(true); setError("");
    try {
      const demo = isDemoMode();
      const selectedIds = selectedDemoCourses();
      const readDemoCards = () => demoAssignments.filter(a => selectedIds.includes(a.canvasCourseId)).map(a => demoStore.shelf(a.id));
      let value = demo ? readDemoCards() : await request<ShelfCard[]>("/api/private/shelf");
      const candidates = value.filter(card => card.effortSource !== "student" && (retry
        ? card.effortStatus !== "ready"
        : demo ? demoStore.get(card.assignment.id).aiEffort?.sourceHash !== "" : card.effortStatus === "pending"));
      if (candidates.length) {
        await estimateBatch(candidates, async card => {
          const assignmentId = card.assignment.id;
          const cached = demo ? demoStore.get(assignmentId).aiEffort : null;
          try {
            const headers: Record<string, string> = {};
            if (demo && !retry && cached?.sourceHash) headers["x-nook-effort-hash"] = cached.sourceHash;
            if (retry) headers["x-nook-retry"] = "true";
            const result = await requestEffort(`/api/${demo ? "demo" : "private"}/assignments/${assignmentId}/effort`, headers);
            if (ticket !== shelfRun.current) return;
            if (demo && !("unchanged" in result)) {
              try { demoStore.saveAiEffort(assignmentId, result); }
              catch { /* Valid estimate remains in memory; the shelf displays the storage warning. */ }
            }
          } catch (e) {
            if (ticket !== shelfRun.current) return;
            if (code(e) === "UNAUTHORIZED") throw e;
            if (demo && !cached) {
              try { demoStore.saveAiEffort(assignmentId, { effortEstimate: null, effortStatus: "unavailable", needsReview: true, sourceHash: "" }); }
              catch { /* Preserve in-memory estimate and the storage warning. */ }
            }
          }
        }, (completed, total) => { if (ticket === shelfRun.current) setEstimation({ completed, total }); }, () => ticket !== shelfRun.current);
        if (ticket !== shelfRun.current) return;
        value = demo ? readDemoCards() : await request<ShelfCard[]>("/api/private/shelf");
      }
      if (ticket !== shelfRun.current) return;
      setCards(sortByImportance(value)); setShelfPage(0);
      if (demo && demoStore.warning()) setError(demoStore.warning());
    } catch (e) {
      if (ticket !== shelfRun.current) return;
      if (code(e) === "UNAUTHORIZED") router.replace("/sign-in");
      else setError(message(e));
    } finally { if (ticket === shelfRun.current) { setLoading(false); setEstimation(null); } }
  }, [router]);
  useEffect(() => {
    return invalidateShelf;
  }, [screen, invalidateShelf]);


  useEffect(() => {
    if (screen === "import") void Promise.resolve().then(loadCourses);
    if (screen === "shelf") void Promise.resolve().then(() => loadShelf());
    if (["assignment", "current", "checkpoint", "welcome-back"].includes(screen)) void Promise.resolve().then(loadDetail);
  }, [screen, loadCourses, loadDetail, loadShelf]);

  async function auth(event: FormEvent<HTMLFormElement>, signUp: boolean) {
    event.preventDefault(); setError(""); setInfo("");
    if (signUp && password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const supabase = createClient();
      const result = signUp ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      setDemoFlag(DEMO_MODE_KEY, null);
      if (signUp) { router.push("/coming-later"); return; }
      try { await request<Course[]>("/api/private/canvas/courses"); router.push("/shelf"); }
      catch (e) { if (code(e) === "CANVAS_NOT_AVAILABLE") router.push("/coming-later"); else if (code(e) === "CANVAS_NOT_CONFIGURED") router.push("/connect"); else { setError(message(e)); router.push("/connect"); } }
      router.refresh();
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function resetPassword() { if (!email) { setError("Enter your email first."); return; } setBusy(true); setError(""); try { const { error: e } = await createClient().auth.resetPasswordForEmail(email); if (e) throw e; setInfo("Password reset email sent."); } catch (e) { setError(message(e)); } finally { setBusy(false); } }
  async function signOut() { if (!isDemoMode()) await createClient().auth.signOut(); setDemoFlag(ACTIVE_KEY, null); setDemoFlag(DEMO_MODE_KEY, null); router.push("/"); router.refresh(); }
  async function tryDemo() {
    setDemoFlag(DEMO_MODE_KEY, "true");
    if (!demoFlag(DEMO_COURSES_KEY)) setDemoFlag(DEMO_COURSES_KEY, JSON.stringify(demoCourses.map(c => c.id)));
    try { demoStore.begin(); } catch { /* The shelf explains that progress is only in memory. */ }
    router.push("/shelf");
  }
  function mutationError(e: unknown) { if (code(e) === "UNAUTHORIZED") router.push("/sign-in"); else setError(message(e)); }
  async function sync() { setBusy(true); setError(""); setSyncNote(""); try { if (isDemoMode()) { setDemoFlag(DEMO_COURSES_KEY, JSON.stringify(selected)); setSyncNote("Demo courses updated."); router.push("/shelf"); return; } const result = await request<{ imported: number; updated: number; failures: { courseId: string; message: string }[] }>("/api/private/canvas/sync", json("POST", { courseIds: selected })); setSyncNote(`${result.imported} imported, ${result.updated} updated.`); if (result.failures.length) setError(`${result.failures.length} course${result.failures.length === 1 ? "" : "s"} could not sync: ${result.failures.map(f => f.message).join("; ")}`); else router.push("/shelf"); } catch (e) { mutationError(e); } finally { setBusy(false); } }
  async function breakdown() {
    if (!id || busy) return;
    const demo = isDemoMode();
    if (demo && steps.length && !window.confirm("Generate a new AI draft? If generation succeeds, it will replace the current demo steps. Your current plan stays if generation fails.")) return;
    const ticket = ++generation.current, version = revision.current, assignmentId = id;
    setBusy(true); setError("");
    try {
      const value = await request<Draft>(`/api/${demo ? "demo" : "private"}/assignments/${id}/breakdown`, { method: "POST" });
      if (ticket !== generation.current || assignmentId !== currentId.current) return;
      if (revision.current !== version) { setDraftNote("Your edits were kept. Generate again when you are ready to replace them."); return; }
      if (!value.steps.length) { setDraftNote("AI draft unavailable. Make a manual plan or try Generate plan again. Your existing progress is unchanged."); return; }
      const next: DraftStep[] = value.steps.map(s => ({ ...s, id: demo ? crypto.randomUUID() : undefined, done: false, source: "suggested" }));
      const { min, max } = estimateHourRange(value);
      const note = `AI-generated suggestion · editable. ${value.needsReview ? "Review needed. Check these suggestions against the original instructions. " : ""}${value.note}`;
      setEffortMinHours(min); setEffortMaxHours(max); setDraftNote(note); stagePlan(next, min, max);
      if (demo) {
        demoStore.patch(id, { draftNote: value.note, needsReview: value.needsReview }, false);
        flushDemo();
      }
    } catch (e) { if (ticket === generation.current) setError(message(e)); }
    finally { if (ticket === generation.current) setBusy(false); }
  }
  function updateStep(index: number, patch: Partial<DraftStep>) { stagePlan(steps.map((s, i) => i === index ? { ...s, ...patch, ...(patch.text !== undefined || patch.minutes !== undefined ? { source: "student" as const } : {}) } : s)); }
  async function savePlan(thenWork = false, override?: DraftStep[]) { if (!id) return; const plan = override ?? steps; if (isDemoMode()) { stagePlan(plan); if (flushDemo()) { await loadDetail(); if (thenWork) router.push(`/current/${id}`); } return; } if (plan.length < 1 || plan.length > 6 || plan.some(s => !s.text.trim() || s.minutes < 10 || s.minutes > 480)) { setError("Enter 1–6 steps, each 10–480 minutes, and review the plan."); return; } if (!Number.isInteger(effortMinHours) || !Number.isInteger(effortMaxHours) || effortMinHours < 1 || effortMinHours > 40 || effortMaxHours < effortMinHours || effortMaxHours > 50) { setError("Choose an effort range from 1 to 50 hours."); return; } setBusy(true); setError(""); try { await request(`/api/private/assignments/${id}/plan`, json("PUT", { effortMinMinutes: effortMinHours * 60, effortMaxMinutes: effortMaxHours * 60, steps: plan.map(s => ({ ...s, text: s.text.trim() })) })); setInfo("Plan saved."); await loadDetail(); if (thenWork) router.push(`/current/${id}`); } catch (e) { mutationError(e); } finally { setBusy(false); } }
  async function saveThought() { if (!id || !thoughtText.trim()) { setError("Write a short thought first."); return; } setBusy(true); setError(""); try { if (isDemoMode()) demoStore.saveThought(id, thoughtKind, thoughtText); else await request(`/api/private/assignments/${id}/thoughts`, json("POST", { kind: thoughtKind, text: thoughtText.trim() })); setThoughtText(""); setInfo(""); await loadDetail(); } catch (e) { mutationError(e); } finally { setBusy(false); } }
  async function saveCheckpoint() { if (!id || !checkpointNote.trim()) { setError("Write where you left off."); return; } setBusy(true); setError(""); try { if (isDemoMode()) demoStore.saveCheckpoint(id, checkpointNote, nextStep); else await request(`/api/private/assignments/${id}/checkpoints`, json("POST", { note: checkpointNote.trim(), nextStep: nextStep.trim() })); router.push(`/welcome-back/${id}`); } catch (e) { mutationError(e); } finally { setBusy(false); } }
  async function saveEditedNext() { if (!id) return; setBusy(true); setError(""); try { if (isDemoMode()) demoStore.saveCheckpoint(id, detail?.latestCheckpoint?.note || "Ready to continue", nextStep); else await request(`/api/private/assignments/${id}/checkpoints`, json("POST", { note: detail?.latestCheckpoint?.note || "Ready to continue", nextStep: nextStep.trim() })); setEditingNext(false); await loadDetail(); } catch (e) { mutationError(e); } finally { setBusy(false); } }
  const currentHref = id ? `/current/${id}` : "/shelf";
  const shelfPageCount = Math.ceil(cards.length / 3);
  const visibleCards = cards.slice(shelfPage * 3, shelfPage * 3 + 3);
  const status = detail && steps.length ? `${steps.filter(s => s.done).length} of ${steps.length} steps done` : "Not started";

  if (screen === "welcome") return <Frame className="welcome-screen"><div className="welcome-middle"><span className="eyebrow">Nook</span><h1>Let’s make room for your work.</h1><p>Nook turns your coursework into a plan you can actually start. Just a gentle place to begin.</p></div><Panel tone="peach"><strong><BookOpen size={18} strokeWidth={2.3}/> What Nook reads</strong><ul className="tone-list"><li>Your active courses and assignment titles</li><li>Instructions and Canvas due dates</li></ul></Panel><Panel tone="lavender"><strong><Lock size={18} strokeWidth={2.3}/> What stays yours</strong><ul className="tone-list"><li>Your ideas and private reflections</li><li>Where you paused, ready when you return</li></ul></Panel><div className="stack welcome-actions"><Button href="/connect">Connect Canvas</Button><Button onClick={() => void tryDemo()} variant="outline" disabled={busy}>{busy ? "Preparing demo…" : "Try demo coursework"}</Button></div>{error && <Notice>{error}</Notice>}</Frame>;
  if (screen === "sign-in" || screen === "sign-up") return <Frame className="auth-screen"><div className="auth-main"><h1>{screen === "sign-in" ? "Login" : "Create Account"}</h1><p>{screen === "sign-in" ? "Welcome back, we missed you." : "Next, you can see whether Canvas is available for your account."}</p><form onSubmit={e => void auth(e, screen === "sign-up")} className="stack"><label className="sr-only" htmlFor="email">Email</label><input id="email" type="email" placeholder="Email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/><label className="sr-only" htmlFor="password">Password</label><input id="password" type="password" placeholder="Password" autoComplete={screen === "sign-up" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={e => setPassword(e.target.value)}/>{screen === "sign-up" && <><label className="sr-only" htmlFor="confirm">Confirm password</label><input id="confirm" type="password" placeholder="Confirm Password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)}/></>}{screen === "sign-in" && <button type="button" className="text-link align-right" onClick={() => void resetPassword()} disabled={busy}>Forgot your password?</button>}{error && <Notice>{error}</Notice>}{info && <Notice tone="info">{info}</Notice>}<Button type="submit" disabled={busy}>{busy ? "Please wait…" : screen === "sign-in" ? "Sign In" : "Sign Up"}</Button><Button href={screen === "sign-in" ? "/sign-up" : "/sign-in"} variant="outline">{screen === "sign-in" ? "Create new account" : "Already have an account?"}</Button></form></div><p className="fine-print">Your coursework stays private to your account.</p></Frame>;
  if (screen === "coming-later") return <Frame className="simple-screen"><div className="simple-main"><IconCircle/><h1>Canvas connection<br/>coming later</h1><p>Your account is ready. Individual Canvas connections are still on the way. We’ll make room for your work here when they arrive.</p><Panel tone="lavender"><strong>For now</strong><span>The presenter flow is available only to the configured Canvas account.</span></Panel></div><div className="stack"><Button onClick={() => void signOut()} variant="outline">Sign out</Button></div></Frame>;
  if (screen === "connect") return <Frame className="simple-screen"><div className="simple-main"><span className="eyebrow">Nook</span><h1>Canvas connection coming later</h1><p>Connecting your Canvas account is postponed until we obtain an institution-issued developer key. You can explore Nook now with fictional demo coursework.</p></div><div className="stack"><Button onClick={() => void tryDemo()}>Try demo coursework</Button><Button href="/" variant="outline">Back to home</Button></div></Frame>;
  if (screen === "import") return <Frame className="import-screen" showNav>
    <header className="page-head"><div><span className="eyebrow">Nook</span><h1>Import your courses</h1><p>Choose the courses Nook should read.</p></div></header>
    {loading ? <p className="loading">Loading courses…</p> : <>
      <label className="select-all"><input type="checkbox" checked={courses.length > 0 && selected.length === courses.length} onChange={e => setSelected(e.target.checked ? courses.map(c => c.id) : [])}/> Select all</label>
      <div className="course-list">{courses.map(c => <label className="course-card" key={c.id}>
        <input type="checkbox" checked={selected.includes(c.id)} onChange={e => setSelected(v => e.target.checked ? [...v, c.id] : v.filter(x => x !== c.id))}/>
        <span><strong>{c.name}</strong><small>{c.lastSyncedAt ? `Last synced ${date(c.lastSyncedAt, { month: "short", day: "numeric" })}` : "Ready to import"}</small></span>
      </label>)}</div>
      {!courses.length && !error && <Panel tone="lavender">No active courses are available yet.</Panel>}
      <Panel tone="peach" className="selection-summary"><strong>{selected.length} course{selected.length === 1 ? "" : "s"} selected</strong><span>Only selected courses appear on your shelf. Your saved work stays here if you deselect a course.</span></Panel>
    </>}
    {syncNote && <Notice tone="info">{syncNote}</Notice>}
    {error && <Notice>{error} <button className="inline-link" onClick={() => void loadCourses()}>Retry</button></Notice>}
    <div className="page-actions"><Button onClick={() => void sync()} disabled={busy || loading}>{busy ? "Saving…" : selected.length ? "Import assignments" : "Save selection"}</Button><Button href="/shelf" variant="outline">Back to Shelf</Button></div>
  </Frame>;
  if (screen === "shelf" && estimation) return <Frame><header className="page-head"><h1>Making room for your work.</h1><p role="status">Estimating effort: {estimation.completed} of {estimation.total}</p></header><p>We’re considering the assignment instructions and due dates to order your shelf. Your plans and progress stay unchanged.</p><progress max={estimation.total} value={estimation.completed} aria-label="Effort estimates completed" /></Frame>;
  if (screen === "shelf") return <Frame footer={<BottomBar active="shelf" allowedIds={cards.map(card => card.assignment.id)}/>}>
    <div className="shelf-heading"><span className="eyebrow">Nook</span><Link className="utility-pill" href="/import"><RefreshCw size={16} strokeWidth={2.3}/> Sync courses</Link></div><header className="page-head"><div><h1>Your shelf.</h1><p>A little room for your coursework. Take it in any order.</p></div></header>
    {loading && <p className="loading">Loading your shelf…</p>}
    {error && <Notice>{error} <button className="inline-link" onClick={() => void loadShelf()}>Retry</button></Notice>}
    {!loading && (!error || cards.length > 0) && <>
      <div className="shelf-list">{visibleCards.map(card => <AssignmentCard key={card.assignment.id} card={card}/>)}</div>
      {shelfPageCount > 1 && <nav className="shelf-pagination" aria-label="Shelf pages">
        <button type="button" aria-label="Previous page" onClick={() => setShelfPage(page => Math.max(0, page - 1))} disabled={shelfPage === 0}>←</button>
        <span>Page {shelfPage + 1} of {shelfPageCount}</span>
        <button type="button" aria-label="Next page" onClick={() => setShelfPage(page => Math.min(shelfPageCount - 1, page + 1))} disabled={shelfPage === shelfPageCount - 1}>→</button>
      </nav>}
      {!cards.length && <Panel tone="lavender" className="empty-card"><strong>Your shelf is ready.</strong><span>Import a course to see ungraded assignments here.</span><Button href="/import" variant="peach">Import courses</Button></Panel>}
      {cards.some(card => card.effortStatus === "unavailable" || card.effortStatus === "pending") && <Notice tone="info">Some effort estimates are unavailable. Those assignments use due-date order. <button className="inline-link" onClick={() => void loadShelf(true)}>Retry estimates</button></Notice>}
      <p className="footnote">Ordered by effort and due date. A start-by date is a nudge to make room for your work.</p>
    </>}
  </Frame>;
  if (["assignment", "current", "checkpoint", "welcome-back"].includes(screen) && loading && !detail) return <Frame showNav><p className="loading">Loading your work…</p></Frame>;
  if (["assignment", "current", "checkpoint", "welcome-back"].includes(screen) && !detail) return <Frame showNav><Notice>{error || "This assignment is unavailable."}</Notice><Button href="/shelf" variant="outline">Back to Shelf</Button></Frame>;
  if (!detail) return null;
  const a = detail.assignment;
  if (screen === "assignment") return <Frame className="detail-screen" showNav activeId={id}>
    <Link className="back-link" href="/shelf"><ArrowLeft size={18} strokeWidth={2.3}/> Back to Shelf</Link>
    <div className="assignment-title"><div className="detail-meta"><span className="eyebrow">{a.courseName}</span><span className="status-pill soft">{status}</span></div><h1>{a.title}</h1><p>Canvas due: {date(a.dueAt)}</p></div>
    <Panel tone="peach" className="start-panel"><strong>Suggested start</strong><span>{startCard?.startByAt ? date(startCard.startByAt, { weekday: "long", month: "short", day: "numeric" }) : startCard?.startByState === "overdue" ? "Start when you can" : "No start date suggested"}</span><small>{startCard?.startByReason || "Save a plan to see when to begin."}</small></Panel>
    {a.canvasUrl && <a className="canvas-link" href={a.canvasUrl} target="_blank" rel="noopener noreferrer">View original instructions in Canvas ↗</a>}
    {a.descriptionText && <details className="instructions"><summary>Assignment instructions</summary><p>{a.descriptionText}</p></details>}
    <div className="section-heading"><span>Your small steps</span><button className="text-link" onClick={() => void breakdown()} disabled={busy}>{busy ? "Thinking…" : "Generate plan"}</button></div>
    {draftNote && <Notice tone="info">{draftNote}</Notice>}
    <div className="step-editor">{steps.map((s, i) => <div className="edit-step" key={s.id ?? i}>
      <label className="round-check"><input type="checkbox" aria-label={`Mark step ${i + 1} done`} checked={s.done} onChange={e => updateStep(i, { done: e.target.checked })}/><span><Check size={14} strokeWidth={3}/></span></label>
      <div className="step-fields"><label className="sr-only" htmlFor={`step-${i}`}>Step {i + 1}</label><input id={`step-${i}`} className={s.done ? "done" : ""} value={s.text} onBlur={() => { if (isDemoMode() && saveTimer.current) flushDemo(); }} maxLength={140} onChange={e => updateStep(i, { text: e.target.value })} placeholder="Small next step"/><label className="minutes-label">About <input type="number" min={10} max={480} value={s.minutes} onBlur={() => { if (isDemoMode() && saveTimer.current) flushDemo(); }} onChange={e => updateStep(i, { minutes: Number(e.target.value) })}/> min</label></div>
      <button className="remove-step" aria-label={`Remove step ${i + 1}`} onClick={() => stagePlan(steps.filter((_, n) => n !== i))}><Trash2 size={17} strokeWidth={2.2}/></button>
    </div>)}</div>
    {steps.length < 6 && <button className="add-step" onClick={() => stagePlan([...steps, { id: isDemoMode() ? crypto.randomUUID() : undefined, text: "", minutes: 30, done: false, source: "student" }])}>＋ Add a step</button>}
    {(steps.length > 0 || effortMinHours > 0) && <div className="effort"><span className="eyebrow">Estimated effort</span><div className="effort-fields"><label>From<input type="number" step={1} min={1} max={40} value={effortMinHours} onBlur={() => { if (isDemoMode() && saveTimer.current) flushDemo(); }} onChange={e => { const value = Math.min(40, Math.max(1, Math.round(Number(e.target.value)))); const max = Math.max(value, effortMaxHours); setEffortMinHours(value); setEffortMaxHours(max); stagePlan(steps, value, max); }}/></label><span>–</span><label>To<input type="number" step={1} min={1} max={50} value={effortMaxHours} onBlur={() => { if (isDemoMode() && saveTimer.current) flushDemo(); }} onChange={e => { const value = Math.min(50, Math.max(1, effortMinHours, Math.round(Number(e.target.value)))); setEffortMaxHours(value); stagePlan(steps, effortMinHours, value); }}/></label><strong>hours</strong></div><small>A little breathing room is built into your suggested start.</small></div>}
    {error && <Notice>{error}</Notice>}{info && <Notice tone="info">{info}</Notice>}
    <div className="split-actions"><Button onClick={() => void savePlan()} variant="outline" disabled={busy}>{busy ? "Saving…" : "Save"}</Button><Button onClick={() => void savePlan(true)} disabled={busy}>Start work</Button></div>
  </Frame>;
  if (screen === "current") { const next = detail.steps.find(s => !s.done); return <Frame className="detail-screen" footer={<BottomBar active="current" id={id}/>}><header className="page-head"><div><span className="eyebrow">Nook</span><h1>Current work</h1><p>One small step at a time.</p></div></header><Panel tone="lavender" className="work-card"><div className="card-top"><span className="eyebrow">{a.courseName}</span><Link className="utility-pill" href="/shelf">Change</Link></div><h2>{a.title}</h2><p>Canvas due: {date(a.dueAt)}</p><div className="card-inset"><span className="eyebrow">Your next step</span><strong>{next?.text ?? "All planned steps done"}</strong><small>{next ? "Take your time with this one." : "You can pause or add another step."}</small></div></Panel>{next && <button className="add-step mark-done" disabled={busy} onClick={() => void savePlan(false, steps.map(s => s.id === next.id ? { ...s, done: true } : s))}><Check size={16} strokeWidth={3}/> Mark this step done</button>}<section className="thought-section"><h2>Save a thought</h2><label className="sr-only" htmlFor="thought">Write a quick thought</label><textarea id="thought" maxLength={160} placeholder="A sentence is enough..." value={thoughtText} onChange={e => setThoughtText(e.target.value)}/><div className="kind-picker"><button className={thoughtKind === "idea" ? "active" : ""} onClick={() => setThoughtKind("idea")}>Idea</button><button className={thoughtKind === "reflection" ? "active" : ""} onClick={() => setThoughtKind("reflection")}>Private reflection</button></div>{detail.thoughts.length > 0 && <section className="saved-thoughts" aria-label="Saved Thoughts"><h3>Saved Thoughts</h3><ul>{detail.thoughts.map(t => <li key={t.id}><strong>{t.kind === "idea" ? "Idea" : "Reflection"}:</strong> {t.text}</li>)}</ul></section>}</section>{error && <Notice>{error}</Notice>}{info && <Notice tone="info">{info}</Notice>}<div className="page-actions work-actions"><Button onClick={() => void saveThought()} disabled={busy}>{busy ? "Saving…" : "Save thought"}</Button><Button href={`/checkpoint/${id}`} variant="outline">I’m done for now</Button></div></Frame>; }
  if (screen === "checkpoint") return <Frame className="detail-screen" showNav activeId={id}><span className="eyebrow">Nook</span><header className="page-head"><h1>Pause here.</h1><p>A sentence about where you stopped is enough.</p></header><span className="course-pill">{a.title}</span><div className="checkpoint-form"><label htmlFor="checkpoint-note">Where did you stop?</label><textarea id="checkpoint-note" maxLength={500} required placeholder="I got to..." value={checkpointNote} onChange={e => setCheckpointNote(e.target.value)}/><label htmlFor="next-step">One small next step (optional)</label><textarea id="next-step" maxLength={200} placeholder="Next time, I could..." value={nextStep} onChange={e => setNextStep(e.target.value)}/></div>{error && <Notice>{error}</Notice>}<div className="page-actions"><Button onClick={() => void saveCheckpoint()} disabled={busy}>{busy ? "Saving…" : "Save and leave"}</Button><Button href={currentHref} variant="outline">Keep working</Button></div></Frame>;
  return <Frame className="return-screen" showNav activeId={id}><span className="eyebrow">Nook</span><h1>You picked it up again.</h1><p>Here’s where you left your work.</p><Panel tone="peach"><strong>Where you stopped</strong><span>{detail.latestCheckpoint?.note || detail.welcomeBack.message || "Your work is ready when you are."}</span></Panel><Panel tone="lavender"><strong>Saved idea</strong><span>{detail.welcomeBack.ideaText || "No idea saved yet."}</span></Panel><Panel tone="lavender"><strong>Next small step</strong><span>{detail.latestCheckpoint?.nextStep || detail.welcomeBack.nextAction || "Choose a step to continue."}</span></Panel>{editingNext && <div className="edit-next"><label htmlFor="edit-next">Your next step</label><textarea id="edit-next" value={nextStep} onChange={e => setNextStep(e.target.value)} maxLength={200}/><Button onClick={() => void saveEditedNext()} disabled={busy}>{busy ? "Saving…" : "Save next step"}</Button></div>}<div className="page-actions"><Button href={currentHref}>Continue working</Button><Button onClick={() => { setNextStep(detail.latestCheckpoint?.nextStep || detail.welcomeBack.nextAction); setEditingNext(true); }} variant="outline">Edit next step</Button><Button href="/shelf" variant="outline">Back to Shelf</Button></div></Frame>;
}

function AssignmentCard({ card }: { card: ShelfCard }) {
  const a = card.assignment;
  const label = card.startByState === "overdue" || card.startByState === "start_now" ? "Start when you can" : card.startByAt ? date(card.startByAt, { weekday: "long", month: "short", day: "numeric" }) : "No start date suggested";
  const statusLabel = card.stepsTotal && card.stepsDone === card.stepsTotal ? "Done" : card.startByState === "overdue" || card.startByState === "start_now" ? "Start when you can" : !a.dueAt ? "No due date" : "Scheduled";
  const statusTone = statusLabel === "Done" ? "calm" : statusLabel === "Start when you can" ? "warm" : statusLabel === "No due date" ? "quiet" : "soft";
  return <article className="shelf-card">
    <div className="card-top"><span className="eyebrow">{a.courseName}</span><small className={`status-pill ${statusTone}`}>{statusLabel}</small></div>
    <h2>{a.title}</h2>
    <p>Canvas due: {date(a.dueAt)}</p>
    <p>{card.effortEstimate ? `Estimated effort: ${Math.floor(card.effortEstimate.minMinutes / 60) || 1}–${Math.ceil(card.effortEstimate.maxMinutes / 60)} hours` : "Effort not estimated"}</p>
    <div className="card-inset"><span className="eyebrow">Suggested start</span><strong>{label}</strong><small>{card.startByReason || (a.dueAt ? "A small step still helps." : "No due date, so no rush.")}</small></div>
    <Link className="open-plan" href={`/assignments/${a.id}`}>Open plan</Link>
    {a.sourceAvailable === false && <small className="unavailable">No longer available in Canvas. Your saved work is here.</small>}
  </article>;
}
