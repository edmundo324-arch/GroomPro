import type { Metadata } from "next";
import "./globals.css";
import "./calendar-search.css";
import { ModuleWorkspaceBridge } from "@/src/components/module-workspace-bridge";

export const metadata: Metadata = { title: "GroomPro Suite", description: "Multi-tenant grooming salon management platform" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<ModuleWorkspaceBridge /></body></html>;
}
