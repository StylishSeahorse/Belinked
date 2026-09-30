import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { currentOwner, ownerExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  if (!(await ownerExists())) redirect("/admin/setup");
  if (await currentOwner()) redirect("/admin");
  return (
    <section className="grid gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-black">Welcome back</h1>
        <p className="text-sm text-muted">Sign in to edit your page.</p>
      </div>
      <LoginForm next={params.next} notice={params.notice?.slice(0, 200)} />
    </section>
  );
}
