"use client";

import { createClient } from "@/src/lib/supabase/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDay, TimeEntry } from "./timer.types";
import { getCurrentWeek, sameLocalDate, toLocalIsoDate } from "./timer.utils";

type TimeEntryRow = {
    id: string | number;
    started_at: string;
    ended_at: string | null;
};
export function useTimerEntries() {
    const supabase = useMemo(() => createClient(), []);
    const week = useMemo(() => getCurrentWeek(), []);
    const today = week.find((day) => day.isToday) ?? week[0];
    const [selectedDate, setSelectedDate] = useState(today.isoDate);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingEntries, setIsLoadingEntries] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [runningEntryId, setRunningEntryId] = useState<string | null>(null);
    const entriesForSelectedDate = useMemo(
        () => entries.filter((entry) => sameLocalDate(entry.startedAt, selectedDate)),
        [entries, selectedDate]
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
            const rows = (data ?? []) as TimeEntryRow[];
            const loadedEntries: TimeEntry[] = rows.map((entry) => ({
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
    const handleStart = useCallback(async () => {
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
    }, [runningEntryId, supabase]);
    const handleStop = useCallback(async () => {
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
    }, [runningEntryId, supabase]);
    return {
        week,
        selectedDate,
        setSelectedDate,
        entriesForSelectedDate,
        isSaving,
        isLoadingEntries,
        errorMessage,
        runningEntryId,
        handleStart,
        handleStop,
    };
}