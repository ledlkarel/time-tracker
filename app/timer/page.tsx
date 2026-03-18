"use client";

import { createClient } from "@/src/lib/supabase/client";
import { useEffect, useMemo, useState } from "react";

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

function toLocalIsoDate(value: string): string {
    const source = new Date(value);
    const year = source.getFullYear();
    const month = String(source.getMonth() + 1).padStart(2, "0");
    const day = String(source.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function sameLocalDate(isoDateTime: string, isoDate: string): boolean {
    return toLocalIsoDate(isoDateTime) === isoDate;
}

function getMinutesSinceMidnight(value: string): number {
    const source = new Date(value);
    return source.getHours() * 60 + source.getMinutes() + source.getSeconds() / 60;
}

function formatDuration(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0"),
    ].join(":");
}

export default function TimerPage() {
    const supabase = createClient();
    const week = useMemo(() => getCurrentWeek(), []);
    const today = week.find((day) => day.isToday) ?? week[0];
    const [selectedDate, setSelectedDate] = useState(today.isoDate);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingEntries, setIsLoadingEntries] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [runningEntryId, setRunningEntryId] = useState<string | null>(null);
    const entriesForSelectedDate = entries.filter((entry) =>
        sameLocalDate(entry.startedAt, selectedDate)
    );

    useEffect(() => {
        const fetchWeekEntries = async () => {
            setIsLoadingEntries(true);
            setErrorMessage(null);
            const weekStart = `${week[0].isoDate}T00:00:00.000`;
            const weekEnd = `${week[week.length - 1].isoDate}T23:59:59.999`;
            const { data, error } = await supabase
                .from("time_entries")
                .select("id, started_at, ended_at")
                .gte("started_at", weekStart)
                .lte("started_at", weekEnd)
                .order("started_at", { ascending: false });
            setIsLoadingEntries(false);
            if (error) {
                setErrorMessage(error.message);
                return;
            }
            const loadedEntries: TimeEntry[] = (data ?? []).map((entry) => ({
                id: String(entry.id),
                startedAt: entry.started_at,
                endedAt: entry.ended_at,
            }));
            setEntries(loadedEntries);
            const running = loadedEntries.find((entry) => !entry.endedAt);
            setRunningEntryId(running?.id ?? null);
        };
        fetchWeekEntries();
    }, [supabase, week]);

    const timelineSegments = useMemo(() => {
        const MINUTES_PER_DAY = 24 * 60;
        const PIXELS_PER_HOUR = 56;
        const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;
        return entriesForSelectedDate
            .map((entry) => {
                const startMinute = getMinutesSinceMidnight(entry.startedAt);
                const endMinute = entry.endedAt
                    ? getMinutesSinceMidnight(entry.endedAt)
                    : getMinutesSinceMidnight(new Date().toISOString());
                const clampedStart = Math.max(0, Math.min(startMinute, MINUTES_PER_DAY));
                const clampedEnd = Math.max(
                    clampedStart + 1 / 60,
                    Math.min(endMinute, MINUTES_PER_DAY)
                );
                const durationSeconds = Math.max(
                    1,
                    Math.floor((clampedEnd - clampedStart) * 60)
                );
                return {
                    id: entry.id,
                    top: clampedStart * PIXELS_PER_MINUTE,
                    height: (clampedEnd - clampedStart) * PIXELS_PER_MINUTE,
                    startedAt: entry.startedAt,
                    endedAt: entry.endedAt,
                    durationSeconds,
                };
            })
            .sort((a, b) => a.top - b.top);
    }, [entriesForSelectedDate]);

    const timelineHeight = 24 * 56;

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
        setSelectedDate(toLocalIsoDate(newEntry.startedAt));
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
                <h2 className="text-lg font-semibold">Day timeline for {selectedDate}</h2>
                {isLoadingEntries ? (
                    <p className="mt-2 text-sm text-neutral-600">Loading entries...</p>
                ) : entriesForSelectedDate.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-600">No entries yet for this day.</p>
                ) : (
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-white">
                        <div className="max-h-[34rem] overflow-y-auto p-3">
                            <div className="relative" style={{ height: timelineHeight }}>
                                {Array.from({ length: 25 }, (_, hour) => (
                                    <div
                                        key={hour}
                                        className="absolute inset-x-0 border-t border-dashed border-neutral-200"
                                        style={{ top: hour * 56 }}
                                    >
                                        <span className="-translate-y-1/2 bg-white pr-2 text-xs text-neutral-500">
                                            {String(hour).padStart(2, "0")}:00
                                        </span>
                                    </div>
                                ))}
                                <div className="absolute inset-y-0 left-16 right-0">
                                    {timelineSegments.map((entry) => (
                                        <article
                                            key={entry.id}
                                            className="absolute left-2 right-3 rounded-md border border-blue-200 bg-blue-100 px-3 py-2 text-sm"
                                            style={{ top: entry.top, height: entry.height }}
                                        >
                                            <p className="font-medium text-blue-900">Tracked task</p>
                                            <p className="text-xs text-blue-800">
                                                {new Date(entry.startedAt).toLocaleTimeString(undefined, {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                                {" - "}
                                                {entry.endedAt
                                                    ? new Date(entry.endedAt).toLocaleTimeString(undefined, {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })
                                                    : "Running"}
                                            </p>
                                            <p className="text-xs text-blue-800">
                                                {formatDuration(entry.durationSeconds)}
                                            </p>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}