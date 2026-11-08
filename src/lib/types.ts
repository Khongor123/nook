// Dates sent between the browser and server are ISO 8601 strings.
export type ISODateString = string;

export type AssignmentStatus = "open" | "submitted";
export type ThoughtKind = "idea" | "reflection";
export type StepSource = "suggested" | "student";

export interface Assignment {
  id: string;
  userId: string;
  canvasCourseId: string;
  canvasAssignmentId: string;
  courseName: string;
  title: string;
  // Plain text from Canvas, not raw HTML.
  descriptionText: string;
  dueAt: ISODateString | null;
  canvasUrl?: string | null;
  unlockAt?: ISODateString | null;
  sourceAvailable?: boolean;
  timeZone: string;
  updatedAt: ISODateString;
  status: AssignmentStatus;
}

export interface Step {
  id: string;
  assignmentId: string;
  text: string;
  minutes: number;
  done: boolean;
  source: StepSource;
}

export interface Thought {
  id: string;
  assignmentId: string;
  // A reflection is a note. It never becomes a task automatically.
  kind: ThoughtKind;
  text: string;
  createdAt: ISODateString;
}

export interface Checkpoint {
  id: string;
  assignmentId: string;
  note: string;
  nextStep: string;
  createdAt: ISODateString;
}

export interface EffortEstimate { minMinutes: number; maxMinutes: number }
export type EffortStatus = "pending" | "ready" | "unavailable";
export interface EffortResult {
  effortEstimate: EffortEstimate | null;
  effortStatus: Exclude<EffortStatus, "pending">;
  needsReview: boolean;
  sourceHash: string;
}
export interface ShelfCard {
  effortEstimate?: EffortEstimate | null;
  effortSource?: "ai" | "student" | null;
  effortStatus?: EffortStatus;
  assignment: Assignment;
  // Nook's suggestion; the actual Canvas due date stays on Assignment.
  startByAt: ISODateString | null;
  startByReason: string;
  startByState?: "suggested" | "start_now" | "no_due_date" | "overdue" | "needs_plan" | "unavailable";
  stepsDone: number;
  stepsTotal: number;
}

export interface AssignmentDetail {
  assignment: Assignment;
  steps: Step[];
  thoughts: Thought[];
  latestCheckpoint: Checkpoint | null;
}

export interface PrivateAssignmentDetail extends AssignmentDetail {
  effortEstimate: { minMinutes: number; maxMinutes: number } | null;
  welcomeBack: { message: string; nextAction: string; ideaText: string | null };
}
