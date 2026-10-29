import type { Metadata } from "next";
import "./globals.css";
import "./calendar-search.css";
import "./responsive.css";
import "./ui-refinements.css";

export const metadata: Metadata = { title: "GroomPro Suite", description: "Multi-tenant grooming salon management platform" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
