import { redirect } from "next/navigation";
import { SetupForm } from "@/components/AuthForms";
import { ownerExists } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await ownerExists()) redirect("/admin/login");
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-4">
      <section className="w-full max-w-md">
        <h1 className="mb-4 text-3xl font-black">Create the owner account</h1>
        <SetupForm />
      </section>
    </main>
  );
}
