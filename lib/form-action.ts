import { redirect, unstable_rethrow } from "next/navigation";
import { userMessage } from "./errors";

function withParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://local");
  url.searchParams.delete("notice");
  url.searchParams.delete("error");
  url.searchParams.set(key, value.slice(0, 300));
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Runs a form mutation and redirects back to `path` with a flash message:
 * `?notice=` on success, `?error=` on failure. The admin layout renders the flash.
 */
export async function runFormAction(path: string, fn: () => Promise<string | void>): Promise<never> {
  let target: string;
  try {
    const notice = await fn();
    target = withParam(path, "notice", notice || "Saved.");
  } catch (error) {
    unstable_rethrow(error);
    target = withParam(path, "error", userMessage(error));
  }
  redirect(target);
}
