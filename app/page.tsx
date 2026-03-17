import {formatDuration} from "@/lib/time";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Time Tracker</h1>
      <div className="mt-6 space-y-2 text-lg">
        <p>5 seconds → {formatDuration(5)}</p>
        <p>65 seconds → {formatDuration(65)}</p>
        <p>3661 seconds → {formatDuration(3661)}</p>
        <p>3661 seconds → {formatDuration(7322)}</p>
      </div>
    </main>
  );
}
