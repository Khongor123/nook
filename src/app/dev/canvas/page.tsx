import { notFound } from "next/navigation";
import CanvasTester from "./tester";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CanvasTester />;
}
