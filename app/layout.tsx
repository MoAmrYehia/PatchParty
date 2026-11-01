import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Patch Party — Your stream. Their rules.",
  description: "A live survival arena that your Twitch community rewrites. Propose a patch, pick a side, and change the game. Built with Codex.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
