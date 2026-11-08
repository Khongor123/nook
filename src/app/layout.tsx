import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Nook | Room for your work", description: "A calmer place for your coursework, one small step at a time." };
export default function RootLayout({ children }: LayoutProps<"/">) { return <html lang="en"><body>{children}</body></html>; }
