import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Belinked",
  description: "A local-first self-hosted link hub."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
