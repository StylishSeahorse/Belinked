import { redirect } from "next/navigation";
import { LoginForm } from "@/components/AuthForms";
import { currentOwner, ownerExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await ownerExists())) redirect("/admin/setup");
  if (await currentOwner()) redirect("/admin");
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-4">
      <section className="w-full max-w-md">
        <h1 className="mb-4 text-3xl font-black">Owner sign in</h1>
        <LoginForm />
      </section>
    </main>
  );
}
