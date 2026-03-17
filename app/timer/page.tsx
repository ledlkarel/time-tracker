"use client";

import { createClient } from "@/src/lib/supabase/client";
import { useMemo, useState } from "react";

type TimeEntry = {
    id: string;
    startedAt: string;
    endedAt: string | null;
};

type CalendarDay = {
    isoDate: string;
    dayLabel: string;
    dayNumber: string;
    isToday: boolean;
};

function getCurrentWeek(): CalendarDay[] {
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = monday.getDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + index);
        return {
            isoDate: day.toISOString().slice(0, 10),
            dayLabel: day.toLocaleDateString(undefined, { weekday: "short" }),
            dayNumber: day.toLocaleDateString(undefined, { day: "2-digit" }),
            isToday: day.toDateString() === today.toDateString(),
        };
    });
}

function sameLocalDate(isoDateTime: string, isoDate: string): boolean {
    const source = new Date(isoDateTime);
    const localDate = new Date(source.getTime() - source.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
    return localDate === isoDate;
}

export default function TimerPage() {
    const supabase = createClient();
    const week = useMemo(() => getCurrentWeek(), []);
    const today = week.find((day) => day.isToday) ?? week[0];
    const [selectedDate, setSelectedDate] = useState(today.isoDate);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const entriesForSelectedDate = entries.filter((entry) =>
        sameLocalDate(entry.startedAt, selectedDate)
    );
    const [runningEntryId, setRunningEntryId] = useState<string | null>(null);

    const handleStart = async () => {
        if (runningEntryId) return;
        setErrorMessage(null);
        setIsSaving(true);
        const startedAt = new Date().toISOString();
        const { data, error } = await supabase
            .from("time_entries")
            .insert({ started_at: startedAt, ended_at: null })
            .select("id, started_at, ended_at")
            .single();
        setIsSaving(false);
        if (error) {
            setErrorMessage(error.message);
            return;
        }
        const newEntry: TimeEntry = {
            id: String(data.id),
            startedAt: data.started_at,
            endedAt: data.ended_at,
        };
        setEntries((previousEntries) => [newEntry, ...previousEntries]);
        setRunningEntryId(newEntry.id);
        setSelectedDate(newEntry.startedAt.slice(0, 10));
    };

    const handleStop = async () => {
        if (!runningEntryId) return;
        setErrorMessage(null);
        setIsSaving(true);
        const endedAt = new Date().toISOString();
        const { error } = await supabase
            .from("time_entries")
            .update({ ended_at: endedAt })
            .eq("id", runningEntryId);
        setIsSaving(false);
        if (error) {
            setErrorMessage(error.message);
            return;
        }
        setEntries((previousEntries) =>
            previousEntries.map((entry) =>
                entry.id === runningEntryId ? { ...entry, endedAt } : entry
            )
        );
        setRunningEntryId(null);
    };

    return (
        <main className="mx-auto max-w-3xl p-6">
            <h1 className="text-2xl font-semibold">Week Calendar</h1>
            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {week.map((day) => {
                    const isSelected = selectedDate === day.isoDate;
                    return (
                        <button
                            key={day.isoDate}
                            type="button"
                            onClick={() => setSelectedDate(day.isoDate)}
                            className={`rounded-lg border px-3 py-4 text-left transition ${isSelected
                                ? "border-blue-600 bg-blue-50"
                                : "border-neutral-200 bg-white hover:border-neutral-400"
                                }`}
                        >
                            <p className="text-xs text-neutral-500">{day.dayLabel}</p>
                            <p className="mt-1 text-xl font-semibold">{day.dayNumber}</p>
                            {day.isToday ? (
                                <p className="mt-2 text-xs font-medium text-blue-700">Today</p>
                            ) : null}
                        </button>
                    );
                })}
            </section>
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
            </div>
            {errorMessage ? (
                <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
                    Could not save entry: {errorMessage}
                </p>
            ) : null}
            <section className="mt-6">
                <h2 className="text-lg font-semibold">Entries for {selectedDate}</h2>
                {entriesForSelectedDate.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-600">No entries yet for this day.</p>
                ) : (
                    <ul className="mt-3 space-y-2">
                        {entriesForSelectedDate.map((entry) => (
                            <li key={entry.id} className="rounded border border-neutral-200 p-3">
                                Started at{" "}
                                {new Date(entry.startedAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                })}
                                <p className="text-sm text-neutral-700">
                                    {entry.endedAt ? "Stopped" : "Running"}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}