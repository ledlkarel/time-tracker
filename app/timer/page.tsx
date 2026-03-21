"use client";

import { DayTimeline } from "./DayTimeLine";
import { useTimerEntries } from "./useTimerEntries";
import { WeekDatePicker } from "./WeekDatePicker";
import { formatDuration } from "@/lib/time";

export default function TimerPage() {
    const {
        week,
        selectedDate,
        setSelectedDate,
        entriesForSelectedDate,
        isSaving,
        isLoadingEntries,
        errorMessage,
        runningEntryId,
        runningDurationSeconds,
        handleStart,
        handleStop,
    } = useTimerEntries();
    return (
        <main className="mx-auto max-w-3xl p-6">
            <h1 className="text-2xl font-semibold">Week Calendar</h1>
            <WeekDatePicker
                week={week}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
            />
            <div className="mt-6 flex items-center gap-3">
                <button
                    type="button"
                    onClick={runningEntryId ? handleStop : handleStart}
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
                <DayTimeline selectedDate={selectedDate} entries={entriesForSelectedDate} />
            )}
        </main>
    );
}