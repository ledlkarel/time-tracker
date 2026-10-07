"use client";
import { formatDuration } from "@/lib/time";
import { createClient } from "@/src/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EntryEditDialog } from "./EntryEditDialog";
import { WeekTimeline } from "./WeekTimeLine";
import { useTimerEntries } from "./useTimerEntries";

export function TimerView() {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const timer = useTimerEntries();
    const [taskNameInput, setTaskNameInput] = useState("");
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState<string | null>(null);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const logoutPending = useRef(false);

    useEffect(() => {
        if (timer.isSignedOut) {
            router.replace("/login");
            router.refresh();
        }
    }, [timer.isSignedOut, router]);

    const logOut = async () => {
        if (logoutPending.current || timer.isSaving) return;
        logoutPending.current = true;
        setIsLoggingOut(true);
        setLogoutError(null);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw new Error(error.message);
            router.replace("/login");
            router.refresh();
        } catch (error) {
            setLogoutError(error instanceof Error ? error.message : "Could not log out. Please try again.");
        } finally {
            logoutPending.current = false;
            setIsLoggingOut(false);
        }
    };
    const errorMessage = logoutError ?? timer.errorMessage;
    const editingEntry = timer.entries.find((entry) => entry.id === editingEntryId) ?? null;
    const closeEditor = useCallback(() => setEditingEntryId(null), []);

    return (
        <main className="mx-auto max-w-[1400px] p-6">
            <header className="flex items-start justify-between gap-4">
                <h1 className="text-2xl font-semibold">Week Timeline</h1>
                <button
                    type="button"
                    onClick={logOut}
                    disabled={isLoggingOut || timer.isSaving}
                    className="inline-flex shrink-0 items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                    <svg
                        aria-hidden="true"
                        focusable="false"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <path d="m16 17 5-5-5-5M21 12H9" />
                    </svg>
                    {isLoggingOut ? "Logging out..." : "Log out"}
                </button>
            </header>
            <form className="mt-6 flex flex-wrap items-end gap-3" onSubmit={async (event) => {
                event.preventDefault();
                if (isLoggingOut || timer.isSaving || !timer.isTimerReady) return;
                if (timer.runningEntryId) {
                    await timer.handleStop();
                } else if (await timer.handleStart(taskNameInput)) {
                    setTaskNameInput("");
                }
            }}>
                <div className="w-full max-w-sm">
                    <label htmlFor="task-name" className="mb-1 block text-sm">Task name</label>
                    <input id="task-name" type="text" value={taskNameInput} onChange={(event) => setTaskNameInput(event.target.value)} placeholder="What are you working on?" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" disabled={timer.isSaving || isLoggingOut || Boolean(timer.runningEntryId)} />
                </div>
                <button type="submit" disabled={timer.isSaving || isLoggingOut || !timer.isTimerReady} className={`rounded px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${timer.runningEntryId ? "bg-rose-600" : "bg-emerald-600"}`}>
                    {timer.isSaving ? "Saving..." : timer.runningEntryId ? "Stop" : timer.isTimerReady ? "Start" : "Checking timer..."}
                </button>
                <p aria-label="Running timer duration" className="py-2 font-mono text-sm">{formatDuration(timer.runningDurationSeconds)}</p>
            </form>
            <nav aria-label="Week navigation" className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={timer.goToPreviousWeek} className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">← Previous week</button>
                <button type="button" onClick={timer.goToCurrentWeek} className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">This week</button>
                <button type="button" onClick={timer.goToNextWeek} className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800">Next week →</button>
            </nav>
            <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Select a time block to edit its title, start time, or end time.</p>
            {errorMessage ? (
                <div role="alert" className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
                    <p>{errorMessage}</p>
                    {!logoutError ? <button type="button" onClick={timer.refreshEntries} disabled={timer.isSaving} className="mt-2 underline disabled:opacity-50">Retry loading entries</button> : null}
                </div>
            ) : null}
            {timer.isLoadingEntries ? <p role="status" className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">Loading entries...</p> : <WeekTimeline week={timer.week} entries={timer.entries} nowMs={timer.nowMs} onEntrySelect={setEditingEntryId} />}
            {editingEntry ? (
                <EntryEditDialog
                    key={editingEntry.id}
                    entry={editingEntry}
                    nowMs={timer.nowMs}
                    isSaving={timer.isSaving}
                    onClose={closeEditor}
                    onSave={timer.handleEdit}
                />
            ) : null}
        </main>
    );
}
