"use client";

import { createClient } from "@/src/lib/supabase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TimeEntry } from "./timer.types";
import { getWeekBounds, getWeekFromDate, toLocalIsoDate } from "./timer.utils";

type TimeEntryRow = {
    id: string | number;
    started_at: string;
    ended_at: string | null;
    task_name: string | null;
};

const ENTRY_COLUMNS = "id, started_at, ended_at, task_name";

function toEntry(row: TimeEntryRow): TimeEntry {
    return { id: String(row.id), startedAt: row.started_at, endedAt: row.ended_at, taskName: row.task_name ?? "Untitled task" };
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
}

export function useTimerEntries() {
    const supabase = useMemo(() => createClient(), []);
    const [weekOffset, setWeekOffset] = useState(0);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const today = toLocalIsoDate(new Date(nowMs));
    const week = useMemo(() => {
        const base = new Date(`${today}T12:00:00`);
        base.setDate(base.getDate() + weekOffset * 7);
        return getWeekFromDate(base, new Date(`${today}T12:00:00`));
    }, [today, weekOffset]);
    const { start: weekStart, end: weekEnd } = getWeekBounds(week);

    const [userId, setUserId] = useState<string | null>(null);
    const [isAuthResolved, setIsAuthResolved] = useState(false);
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [runningEntry, setRunningEntry] = useState<TimeEntry | null>(null);
    const [activeLoadedFor, setActiveLoadedFor] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [activeError, setActiveError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);
    const [authReload, setAuthReload] = useState(0);
    const mounted = useRef(false);
    const owner = useRef<string | null>(null);
    const activeEntry = useRef<TimeEntry | null>(null);
    const readyOwner = useRef<string | null>(null);
    const mutationPending = useRef(false);
    const revision = useRef(0);
    const weekKey = `${userId}:${weekStart}:${weekEnd}`;

    useEffect(() => {
        mounted.current = true;
        let cancelled = false;
        let authRevision = 0;
        const applyUser = (id: string | null) => {
            if (cancelled) return;
            if (owner.current !== id) {
                revision.current++;
                owner.current = id;
                activeEntry.current = null;
                readyOwner.current = null;
                setEntries([]);
                setRunningEntry(null);
                setActiveLoadedFor(null);
                setLoadedWeek(null);
                setLoadError(null);
                setActiveError(null);
                setSaveError(null);
            }
            setUserId(id);
            setIsAuthResolved(true);
        };
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "INITIAL_SESSION") return;
            authRevision++;
            setAuthError(null);
            applyUser(session?.user.id ?? null);
        });
        const initialRevision = authRevision;
        void (async () => {
            try {
                const { data, error } = await supabase.auth.getUser();
                if (cancelled || authRevision !== initialRevision) return;
                if (error) throw new Error(error.message);
                setAuthError(null);
                applyUser(data.user?.id ?? null);
            } catch (error) {
                if (cancelled || authRevision !== initialRevision) return;
                setAuthError(`Could not verify your session: ${errorText(error)}`);
                setIsAuthResolved(true);
            }
        })();
        return () => {
            cancelled = true;
            mounted.current = false;
            subscription.unsubscribe();
        };
    }, [supabase, authReload]);

    const refreshEntries = useCallback(() => {
        if (!mutationPending.current) {
            setSaveError(null);
            if (!owner.current) setAuthReload((value) => value + 1);
            setReload((value) => value + 1);
        }
    }, []);

    useEffect(() => {
        const updateClock = () => setNowMs(Date.now());
        const refresh = () => {
            updateClock();
            if (document.visibilityState === "visible") refreshEntries();
        };
        const clock = window.setInterval(updateClock, 1000);
        const poll = window.setInterval(() => {
            if (document.visibilityState === "visible") refreshEntries();
        }, 30000);
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            window.clearInterval(clock);
            window.clearInterval(poll);
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [refreshEntries]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const requestRevision = revision.current;
        const isCurrent = () => !cancelled && requestRevision === revision.current;
        void (async () => {
            try {
                const { data, error } = await supabase.from("time_entries")
                    .select(ENTRY_COLUMNS)
                    .eq("user_id", userId)
                    .is("ended_at", null)
                    .order("started_at", { ascending: false })
                    .limit(2);
                if (!isCurrent()) return;
                if (error) throw new Error(error.message);
                const rows = (data ?? []) as TimeEntryRow[];
                activeEntry.current = rows[0] ? toEntry(rows[0]) : null;
                readyOwner.current = userId;
                setRunningEntry(activeEntry.current);
                setActiveLoadedFor(userId);
                setActiveError(rows.length > 1 ? "Multiple timers are running. Stop each one before starting another." : null);
            } catch (error) {
                if (!isCurrent()) return;
                readyOwner.current = null;
                setActiveLoadedFor(null);
                setActiveError(`Could not check the running timer: ${errorText(error)}`);
            }
        })();
        return () => { cancelled = true; };
    }, [supabase, userId, reload]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        const requestRevision = revision.current;
        const isCurrent = () => !cancelled && requestRevision === revision.current;
        void (async () => {
            try {
                const { data, error } = await supabase.from("time_entries")
                    .select(ENTRY_COLUMNS)
                    .eq("user_id", userId)
                    .lt("started_at", weekEnd)
                    .or(`ended_at.is.null,ended_at.gt.${weekStart}`)
                    .order("started_at", { ascending: false });
                if (!isCurrent()) return;
                if (error) throw new Error(error.message);
                setEntries(((data ?? []) as TimeEntryRow[]).map(toEntry));
                setLoadError(null);
            } catch (error) {
                if (!isCurrent()) return;
                setEntries([]);
                setLoadError(`Could not load entries: ${errorText(error)}`);
            } finally {
                if (isCurrent()) setLoadedWeek(weekKey);
            }
        })();
        return () => { cancelled = true; };
    }, [supabase, userId, weekStart, weekEnd, weekKey, reload]);

    const handleStart = useCallback(async (taskName: string): Promise<boolean> => {
        if (!userId || owner.current !== userId || readyOwner.current !== userId || activeEntry.current || mutationPending.current) return false;
        mutationPending.current = true;
        revision.current++;
        readyOwner.current = null;
        setActiveLoadedFor(null);
        setSaveError(null);
        setIsSaving(true);
        const startedAt = new Date().toISOString();
        try {
            const { data, error } = await supabase.from("time_entries")
                .insert({ user_id: userId, started_at: startedAt, ended_at: null, task_name: taskName.trim() || "Untitled task" })
                .select(ENTRY_COLUMNS)
                .single();
            if (!mounted.current || owner.current !== userId) return false;
            if (error) {
                throw new Error(error.code === "23505" ? "A timer is already running. The current timer will be refreshed." : error.message);
            }
            if (!data) throw new Error("The new entry was not returned. Refresh before trying again.");
            const entry = toEntry(data as TimeEntryRow);
            activeEntry.current = entry;
            setRunningEntry(entry);
            setNowMs(Date.now());
            setEntries((previous) => [entry, ...previous.filter((item) => item.id !== entry.id)]);
            setWeekOffset(0);
            return true;
        } catch (error) {
            if (mounted.current && owner.current === userId) setSaveError(`Could not start timer: ${errorText(error)}`);
            return false;
        } finally {
            // Also invalidate reads begun during the mutation (e.g. week navigation).
            revision.current++;
            readyOwner.current = null;
            mutationPending.current = false;
            if (mounted.current) {
                setActiveLoadedFor(null);
                setIsSaving(false);
                setReload((value) => value + 1);
            }
        }
    }, [supabase, userId]);

    const handleStop = useCallback(async (): Promise<boolean> => {
        const entry = activeEntry.current;
        if (!userId || owner.current !== userId || readyOwner.current !== userId || !entry || mutationPending.current) return false;
        mutationPending.current = true;
        revision.current++;
        readyOwner.current = null;
        setActiveLoadedFor(null);
        setSaveError(null);
        setIsSaving(true);
        try {
            const { data, error } = await supabase.from("time_entries")
                .update({ ended_at: new Date().toISOString() })
                .eq("id", entry.id)
                .eq("user_id", userId)
                .is("ended_at", null)
                .select(ENTRY_COLUMNS)
                .maybeSingle();
            if (!mounted.current || owner.current !== userId) return false;
            if (error) throw new Error(error.message);
            if (!data) throw new Error("The timer was already stopped or is no longer available. Refreshing entries.");
            const stopped = toEntry(data as TimeEntryRow);
            setEntries((previous) => previous.map((entry) => entry.id === stopped.id ? stopped : entry));
            activeEntry.current = null;
            readyOwner.current = null;
            setRunningEntry(null);
            // A fresh lookup must confirm there isn't another active timer before allowing Start.
            setActiveLoadedFor(null);
            return true;
        } catch (error) {
            if (mounted.current && owner.current === userId) setSaveError(`Could not stop timer: ${errorText(error)}`);
            return false;
        } finally {
            revision.current++;
            readyOwner.current = null;
            mutationPending.current = false;
            if (mounted.current) {
                setActiveLoadedFor(null);
                setIsSaving(false);
                setReload((value) => value + 1);
            }
        }
    }, [supabase, userId]);

    const runningDurationSeconds = runningEntry
        ? Math.max(0, Math.floor((nowMs - Date.parse(runningEntry.startedAt)) / 1000))
        : 0;

    return {
        week,
        nowMs,
        entries: loadedWeek === weekKey ? entries : [],
        isSaving,
        isLoadingEntries: !isAuthResolved || Boolean(userId && loadedWeek !== weekKey),
        isTimerReady: Boolean(userId && activeLoadedFor === userId),
        isSignedOut: isAuthResolved && !userId && !authError,
        errorMessage: saveError ?? authError ?? activeError ?? loadError,
        runningEntryId: runningEntry?.id ?? null,
        runningDurationSeconds,
        handleStart,
        handleStop,
        refreshEntries,
        goToPreviousWeek: () => setWeekOffset((value) => value - 1),
        goToNextWeek: () => setWeekOffset((value) => value + 1),
        goToCurrentWeek: () => setWeekOffset(0),
    };
}
