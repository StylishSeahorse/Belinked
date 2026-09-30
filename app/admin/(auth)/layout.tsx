export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="admin-shell grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-xl font-black">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--ui-ink)] text-white" aria-hidden="true">
            B
          </span>
          Belinked
        </div>
        {children}
      </div>
    </main>
  );
}
