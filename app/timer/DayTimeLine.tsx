import { formatDuration } from "@/lib/time";
import type { TimeEntry } from "./timer.types";
import { DAY_HEIGHT, layoutDayEntries, PIXELS_PER_HOUR } from "./timeline.utils";

type DayTimelineProps = {
    selectedDate: string;
    entries: TimeEntry[];
    nowMs: number;
    onEntrySelect?: (id: string) => void;
};

export function DayTimeline({ selectedDate, entries, nowMs, onEntrySelect }: DayTimelineProps) {
    const segments = layoutDayEntries(entries, selectedDate, nowMs);
    return (
        <section className="mt-6">
            <h2 className="text-lg font-semibold">Day timeline for {selectedDate}</h2>
            <div className="mt-3 rounded-lg border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                <div className="max-h-[34rem] overflow-y-auto p-3">
                    <div className="relative" style={{ height: DAY_HEIGHT }}>
                        {Array.from({ length: 25 }, (_, hour) => (
                            <div key={hour} className="absolute inset-x-0 border-t border-dashed border-neutral-200 dark:border-neutral-700" style={{ top: hour * PIXELS_PER_HOUR }}>
                                <span className="bg-white pr-2 text-xs dark:bg-neutral-900">{String(hour).padStart(2, "0")}:00</span>
                            </div>
                        ))}
                        <div className="absolute inset-y-0 left-16 right-0 overflow-hidden">
                            {segments.length === 0 ? <p className="mt-2 text-sm">No entries yet for this day.</p> : segments.map((entry) => (
                                <article key={entry.id} title={`${entry.taskName} — ${formatDuration(entry.durationSeconds)}`} role={onEntrySelect ? "button" : undefined} tabIndex={onEntrySelect ? 0 : undefined} aria-label={onEntrySelect ? `Edit ${entry.taskName}` : undefined} onClick={onEntrySelect ? () => onEntrySelect(entry.id) : undefined} onKeyDown={onEntrySelect ? (event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        onEntrySelect(entry.id);
                                    }
                                } : undefined} className={`absolute overflow-hidden rounded border border-blue-200 bg-blue-100 px-1 text-xs text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 ${onEntrySelect ? "cursor-pointer hover:ring-2 hover:ring-blue-500 focus-visible:outline-2 focus-visible:outline-blue-600" : ""}`} style={{ top: entry.top, height: entry.height, left: `${entry.column * 100 / entry.totalColumns}%`, width: `${100 / entry.totalColumns}%` }}>
                                    <p className="truncate font-medium">{entry.taskName}</p>
                                    {entry.height >= 36 ? <p>{formatDuration(entry.durationSeconds)}{entry.endedAt === null ? " · Running" : ""}</p> : null}
                                </article>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
