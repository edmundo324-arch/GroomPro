import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./calendar-search.css";
import "./responsive.css";
import "./ui-refinements.css";
import "./ticket-workspace.css";

export const metadata: Metadata = { title: "GroomPro Suite", description: "Multi-tenant grooming salon management platform", appleWebApp: {capable:true,title:"GroomPro",statusBarStyle:"default"}, icons:{apple:"/icons/groompro-192.png"} };

export const viewport: Viewport = {width:"device-width",initialScale:1,themeColor:"#17354d"};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
