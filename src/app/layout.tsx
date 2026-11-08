import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nook", description: "A calmer place for your coursework, one small step at a time.", icons: { icon: [{ url: "/logo.png", type: "image/png" }], shortcut: ["/logo.png"], apple: ["/logo.png"] } };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="en"><body>{children}</body></html>; }
