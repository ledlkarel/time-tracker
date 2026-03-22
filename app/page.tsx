import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Welcom to Time Tracker</h1>
      <Link
        href="/timer"
        className="mt-4 inline-block rounded bg-emerald-600 px-4 py-2 font-medium text-white"
      >
        Go track time
      </Link>
    </main>
  );
}
