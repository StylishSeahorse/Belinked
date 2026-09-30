import Link from "next/link";

export const metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper p-6 text-center">
      <div className="grid gap-3">
        <h1 className="text-2xl font-black">Page not found</h1>
        <Link className="btn" href="/">Go to the main page</Link>
      </div>
    </main>
  );
}
