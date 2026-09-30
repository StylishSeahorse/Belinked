import { redirect } from "next/navigation";
import { SetupForm } from "@/components/AuthForms";
import { ownerExists } from "@/lib/auth";
import { setupDefaultsFromEnv } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await ownerExists()) redirect("/admin/login");
  const setupDefaults = setupDefaultsFromEnv();
  return (
    <section className="grid gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-black">Let’s set up your page</h1>
        <p className="text-sm text-muted">Create your sign-in. You’ll be editing your page in a few seconds.</p>
      </div>
      <SetupForm defaults={setupDefaults} />
    </section>
  );
}
