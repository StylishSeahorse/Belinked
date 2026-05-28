import { publicProfileMetadata, renderPublicProfile } from "@/lib/public-profile";

export const dynamic = "force-dynamic";

export const generateMetadata = publicProfileMetadata;

export default async function Home() {
  return renderPublicProfile();
}
