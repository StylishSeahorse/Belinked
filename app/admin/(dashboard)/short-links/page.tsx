import { redirect } from "next/navigation";

// Kept so old bookmarks keep working; this screen is now part of the redesigned editor.
export default function LegacyRedirect() {
  redirect("/admin/settings?tab=short-links");
}
