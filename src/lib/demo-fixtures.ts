import type {
  Assignment,
  AssignmentDetail,
  Checkpoint,
  ShelfCard,
  Step,
  Thought,
} from "./types";

// Fictional coursework only. Do not put a real student's Canvas data here.
const demoUserId = "demo-user";
const timeZone = "America/New_York";
const now = new Date();
const daysFromNow = (days: number) =>
  new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

export const demoAssignments: Assignment[] = [
  {
    id: "demo-assignment-essay",
    userId: demoUserId,
    canvasCourseId: "demo-course-history",
    canvasAssignmentId: "demo-canvas-essay",
    courseName: "History 101",
    title: "Community history essay",
    descriptionText:
      "Write a 900-word essay about a local historical event. Use two course readings and submit a PDF.",
    dueAt: daysFromNow(5),
    timeZone,
    updatedAt: now.toISOString(),
    status: "open",
  },
  {
    id: "demo-assignment-reading",
    userId: demoUserId,
    canvasCourseId: "demo-course-literature",
    canvasAssignmentId: "demo-canvas-reading",
    courseName: "Literature 202",
    title: "Reading reflection",
    descriptionText:
      "Read the assigned chapter and write a short reflection on one passage that stood out.",
    dueAt: null,
    timeZone,
    updatedAt: now.toISOString(),
    status: "open",
  },
  {
    id: "demo-assignment-lab",
    userId: demoUserId,
    canvasCourseId: "demo-course-science",
    canvasAssignmentId: "demo-canvas-lab",
    courseName: "Environmental Science",
    title: "Water sample lab notes",
    descriptionText:
      "Summarize your observations and upload the completed lab notes.",
    dueAt: daysFromNow(-2),
    timeZone,
    updatedAt: now.toISOString(),
    status: "open",
  },
];

export const demoSteps: Step[] = [
  {
    id: "demo-step-read",
    assignmentId: "demo-assignment-essay",
    text: "Read the essay instructions and choose an event",
    minutes: 20,
    done: true,
    source: "suggested",
  },
  {
    id: "demo-step-outline",
    assignmentId: "demo-assignment-essay",
    text: "Make a short outline using two course readings",
    minutes: 40,
    done: false,
    source: "suggested",
  },
  {
    id: "demo-step-draft",
    assignmentId: "demo-assignment-essay",
    text: "Write a first draft",
    minutes: 90,
    done: false,
    source: "suggested",
  },
];

export const demoThoughts: Thought[] = [
  {
    id: "demo-thought-idea",
    assignmentId: "demo-assignment-essay",
    kind: "idea",
    text: "Ask my grandmother what she remembers about the old library.",
    createdAt: daysFromNow(-1),
  },
  {
    id: "demo-thought-reflection",
    assignmentId: "demo-assignment-essay",
    kind: "reflection",
    text: "I'm nervous about getting the first paragraph right.",
    createdAt: now.toISOString(),
  },
];

export const demoCheckpoints: Checkpoint[] = [
  {
    id: "demo-checkpoint-essay",
    assignmentId: "demo-assignment-essay",
    note: "I chose the old library and found one useful reading.",
    nextStep: "Find the second reading and sketch the outline.",
    createdAt: now.toISOString(),
  },
];

export const demoShelfCards: ShelfCard[] = demoAssignments.map((assignment) => {
  const steps = demoSteps.filter((step) => step.assignmentId === assignment.id);
  const isOverdue =
    assignment.dueAt !== null && new Date(assignment.dueAt) < now;

  return {
    assignment,
    // Placeholder example. Person C will replace this with the real rule.
    startByAt:
      assignment.id === "demo-assignment-essay" ? daysFromNow(2) : null,
    startByReason: isOverdue
      ? "Start when you can"
      : assignment.dueAt === null
        ? "No Canvas due date"
        : "A gentle suggestion to leave room before the due date",
    stepsDone: steps.filter((step) => step.done).length,
    stepsTotal: steps.length,
  };
});

export function getDemoAssignmentDetail(id: string): AssignmentDetail | null {
  const assignment = demoAssignments.find((item) => item.id === id);
  if (!assignment) return null;

  const checkpoints = demoCheckpoints
    .filter((checkpoint) => checkpoint.assignmentId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    assignment,
    steps: demoSteps.filter((step) => step.assignmentId === id),
    thoughts: demoThoughts.filter((thought) => thought.assignmentId === id),
    latestCheckpoint: checkpoints[0] ?? null,
  };
}
