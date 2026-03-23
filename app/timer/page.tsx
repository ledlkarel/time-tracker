"use client";
import { formatDuration } from "@/lib/time";
import { useState } from "react";
import { WeekTimeline } from "./WeekTimeLine";
import { useTimerEntries } from "./useTimerEntries";
export default function TimerPage() {
    const {
        week,
        entries,
        isSaving,
        isLoadingEntries,
        errorMessage,
        runningEntryId,
        runningDurationSeconds,
        handleStart,
        handleStop,
    } = useTimerEntries();
    const [taskNameInput, setTaskNameInput] = useState("");
    return (
        <main className="mx-auto max-w-[1400px] p-6">
            <h1 className="text-2xl font-semibold">Week Timeline</h1>
            <div className="mt-6 flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={taskNameInput}
                    onChange={(e) => setTaskNameInput(e.target.value)}
                    placeholder="What are you working on?"
                    className="w-full max-w-sm rounded border border-neutral-300 px-3 py-2 text-sm"
                    disabled={isSaving || Boolean(runningEntryId)}
                />
                <button
                    type="button"
                    onClick={async () => {
                        if (runningEntryId) {
                            await handleStop();
                            return;
                        }
                        const started = await handleStart(taskNameInput);
                        if (started) setTaskNameInput("");
                    }}
                    disabled={isSaving}
                    className={`rounded px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${runningEntryId ? "bg-rose-600" : "bg-emerald-600"
                        }`}
                >
                    {isSaving ? "Saving..." : runningEntryId ? "Stop" : "Start"}
                </button>
                <p className="font-mono text-sm text-white-700">
                    {formatDuration(runningDurationSeconds)}
                </p>
            </div>
            {errorMessage ? (
                <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
                    Could not save entry: {errorMessage}
                </p>
            ) : null}
            {isLoadingEntries ? (
                <p className="mt-6 text-sm text-neutral-600">Loading entries...</p>
            ) : (
                <WeekTimeline week={week} entries={entries} />
            )}
        </main>
    );
}