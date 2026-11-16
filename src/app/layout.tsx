import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent QA Console",
  description: "Independent PM case study: report card and regression checks for hotel AI agents, on synthetic data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
