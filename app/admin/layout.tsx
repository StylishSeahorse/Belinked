import type { Metadata } from "next";

// The admin area must never be indexed, whatever the public profile allows.
export const metadata: Metadata = {
  title: { default: "Belinked admin", template: "%s · Belinked admin" },
  robots: { index: false, follow: false, nocache: true }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
