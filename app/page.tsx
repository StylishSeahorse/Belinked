import { publicProfileMetadata, renderPublicProfile } from "@/lib/public-profile";

export const dynamic = "force-dynamic";

export const generateMetadata = publicProfileMetadata;

export default async function Home({ searchParams }: { searchParams: Promise<{ subscribed?: string; subscribe_error?: string }> }) {
  const params = await searchParams;
  const errors: Record<string, string> = {
    invalid: "Please enter a valid email address.",
    rate: "Too many attempts. Please try again in a few minutes.",
    unavailable: "This signup form is no longer available."
  };
  return renderPublicProfile({ subscribed: params.subscribed === "1", subscribeError: errors[params.subscribe_error || ""] });
}
