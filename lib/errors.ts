import { ZodError } from "zod";

/** An error whose message is safe and useful to show to the owner. */
export class UserError extends Error {}

const FIELD_LABELS: Record<string, string> = {
  url: "URL",
  imageUrl: "Image URL",
  avatarUrl: "Avatar URL",
  logoUrl: "Logo URL",
  ogImageUrl: "Open Graph image URL",
  priorityRedirectUrl: "Redirect URL",
  destination: "Destination",
  displayName: "Display name",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
  startsAt: "Start time",
  endsAt: "End time"
};

function label(path: (string | number)[]) {
  const key = String(path[0] ?? "");
  if (!key) return "";
  return FIELD_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1").toLowerCase();
}

/**
 * Converts any thrown value into a message for the UI. Only validation and explicitly
 * user-facing errors are shown verbatim; anything else is logged server-side and replaced
 * with a generic message so stack traces, SQL, and paths never reach the browser.
 */
export function userMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const field = label(issue.path);
    return field ? `${field}: ${issue.message}` : issue.message;
  }
  if (error instanceof UserError) return error.message;
  if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") {
    return "That value is already in use. Choose a different one.";
  }
  if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2025") {
    return "That item no longer exists. Refresh the page and try again.";
  }
  console.error(error);
  return fallback;
}
