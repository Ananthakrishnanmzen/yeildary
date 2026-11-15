import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yieldary AI — Adapting Farms with NASA Data",
  description:
    "Yieldary AI: orbital field notebook adapting farms with NASA Earth observation data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className="min-h-full bg-ink text-text antialiased">{children}</body>
    </html>
  );
}
