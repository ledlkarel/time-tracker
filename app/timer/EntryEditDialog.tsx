"use client";

import { formatDuration } from "@/lib/time";
import { useEffect, useRef, useState } from "react";
import type { TimeEntry } from "./timer.types";
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "./timer.utils";

type EntryEditDialogProps = {
    entry: TimeEntry;
    nowMs: number;
    isSaving: boolean;
    onClose: () => void;
    onSave: (id: string, changes: { startedAt: string; endedAt: string | null; taskName: string }) => Promise<boolean>;
};

export function EntryEditDialog({ entry, nowMs, isSaving, onClose, onSave }: EntryEditDialogProps) {
    const initialStart = toLocalDateTimeInput(entry.startedAt);
    const initialEnd = entry.endedAt ? toLocalDateTimeInput(entry.endedAt) : "";
    const [taskName, setTaskName] = useState(entry.taskName);
    const [startedAt, setStartedAt] = useState(initialStart);
    const [endedAt, setEndedAt] = useState(initialEnd);
    const [validationError, setValidationError] = useState<string | null>(null);
    const titleInput = useRef<HTMLInputElement>(null);
    const dialog = useRef<HTMLElement>(null);
    const saving = useRef(isSaving);

    useEffect(() => {
        saving.current = isSaving;
    }, [isSaving]);

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        titleInput.current?.focus();
        const closeOnEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !saving.current) onClose();
            if (event.key !== "Tab") return;
            const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", closeOnEscape);
        return () => {
            window.removeEventListener("keydown", closeOnEscape);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [onClose]);

    const parsedStart = startedAt === initialStart
        ? entry.startedAt
        : fromLocalDateTimeInput(startedAt);
    const parsedEnd = endedAt === initialEnd
        ? entry.endedAt
        : endedAt ? fromLocalDateTimeInput(endedAt) : null;
    const endMs = parsedEnd ? Date.parse(parsedEnd) : nowMs;
    const startMs = parsedStart ? Date.parse(parsedStart) : Number.NaN;
    const previewSeconds = Number.isFinite(startMs) ? Math.max(0, Math.floor((endMs - startMs) / 1000)) : 0;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSaving) onClose();
            }}
        >
            <section
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-entry-title"
                className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-neutral-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 id="edit-entry-title" className="text-xl font-semibold">Edit time entry</h2>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                            {entry.endedAt ? "Completed entry" : "Running entry"}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={isSaving} aria-label="Close edit dialog" className="rounded p-1 text-xl leading-none hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800">×</button>
                </div>
                <form className="mt-5 space-y-4" onSubmit={async (event) => {
                    event.preventDefault();
                    setValidationError(null);
                    const nextStartedAt = startedAt === initialStart ? entry.startedAt : fromLocalDateTimeInput(startedAt);
                    if (!nextStartedAt) {
                        setValidationError("Enter a valid local start date and time.");
                        return;
                    }
                    const nextEndedAt = endedAt === initialEnd
                        ? entry.endedAt
                        : endedAt ? fromLocalDateTimeInput(endedAt) : null;
                    if (endedAt && !nextEndedAt) {
                        setValidationError("Enter a valid local end date and time.");
                        return;
                    }
                    if (entry.endedAt && !nextEndedAt) {
                        setValidationError("A completed entry must keep an end time.");
                        return;
                    }
                    const nextStartMs = Date.parse(nextStartedAt);
                    const nextEndMs = nextEndedAt ? Date.parse(nextEndedAt) : null;
                    if (nextEndMs !== null && nextEndMs < nextStartMs) {
                        setValidationError("End time cannot be before the start time.");
                        return;
                    }
                    if (!nextEndedAt && nextStartMs > Date.now()) {
                        setValidationError("A running entry cannot start in the future.");
                        return;
                    }
                    const saved = await onSave(entry.id, {
                        startedAt: nextStartedAt,
                        endedAt: nextEndedAt,
                        taskName: taskName.trim() || "Untitled task",
                    });
                    if (saved) {
                        onClose();
                    } else {
                        setValidationError("Could not save changes. Review the page error and try again.");
                    }
                }}>
                    <div>
                        <label htmlFor="edit-entry-task-name" className="mb-1 block text-sm font-medium">Title</label>
                        <input ref={titleInput} id="edit-entry-task-name" type="text" value={taskName} onChange={(event) => setTaskName(event.target.value)} disabled={isSaving} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
                    </div>
                    <div>
                        <label htmlFor="edit-entry-started-at" className="mb-1 block text-sm font-medium">Started at</label>
                        <input id="edit-entry-started-at" type="datetime-local" step="1" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} required disabled={isSaving} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
                    </div>
                    {entry.endedAt ? (
                        <div>
                            <label htmlFor="edit-entry-ended-at" className="mb-1 block text-sm font-medium">Ended at</label>
                            <input id="edit-entry-ended-at" type="datetime-local" step="1" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} disabled={isSaving} className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" />
                        </div>
                    ) : null}
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">Duration after edit: <span className="font-mono">{formatDuration(previewSeconds)}</span></p>
                    {validationError ? <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{validationError}</p> : null}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} disabled={isSaving} className="rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-neutral-700">Cancel</button>
                        <button type="submit" disabled={isSaving} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? "Saving..." : "Save changes"}</button>
                    </div>
                </form>
            </section>
        </div>
    );
}
