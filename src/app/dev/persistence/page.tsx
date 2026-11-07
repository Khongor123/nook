import { notFound } from "next/navigation";
import PersistenceTester from "./tester";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PersistenceTester />;
}
