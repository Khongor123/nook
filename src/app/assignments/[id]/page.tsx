import { Suspense } from "react";
import NookApp from "@/components/nook-app";
export default function Page({ params }: PageProps<"/assignments/[id]">) { return <Suspense fallback={<div className="phone"><div className="phone-content"><p className="loading">Loading your work…</p></div></div>}><Content params={params}/></Suspense>; }
async function Content({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <NookApp screen="assignment" id={id} />; }
