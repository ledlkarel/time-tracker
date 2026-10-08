import { useEffect, useMemo, useRef, useState } from "react";
import { formatDuration } from "@/lib/time";
import type { TimeEntry, CalendarDay } from "./timer.types";
import { getDayTotalSeconds, layoutDayEntries } from "./timeline.utils";

const HOURS = Array.from({ length: 13 }, (_, index) => index * 2);
const MIN_DAY_HEIGHT = 240;

type WeekTimelineProps = {
    week: CalendarDay[];
    entries: TimeEntry[];
    nowMs: number;
    onEntrySelect?: (id: string) => void;
};

export function WeekTimeline({ week, entries, nowMs, onEntrySelect }: WeekTimelineProps) {
    const sectionRef = useRef<HTMLElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);
    const [dayHeight, setDayHeight] = useState(640);
    const pixelsPerHour = dayHeight / 24;

    useEffect(() => {
        const section = sectionRef.current;
        const gutter = gutterRef.current;
        const parent = section?.parentElement;
        if (!section || !gutter || !parent) return;

        const measure = () => {
            const gutterBounds = gutter.getBoundingClientRect();
            // Include section padding, horizontal scrollbar, and the page's bottom padding.
            const bottomSpace = section.getBoundingClientRect().bottom - gutterBounds.bottom
                + (parseFloat(getComputedStyle(parent).paddingBottom) || 0);
            const top = gutterBounds.top + window.scrollY;
            setDayHeight(Math.max(MIN_DAY_HEIGHT, Math.floor(window.innerHeight - top - bottomSpace - 1)));
        };

        let frame = 0;
        const scheduleMeasure = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        };
        scheduleMeasure();
        window.addEventListener("resize", scheduleMeasure);
        // Re-measure when controls wrap or an error message changes the available space.
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleMeasure);
        observer?.observe(parent);

        return () => {
            window.removeEventListener("resize", scheduleMeasure);
            observer?.disconnect();
            cancelAnimationFrame(frame);
        };
    }, []);

    const dailyTotals = useMemo(
        () => new Map(week.map((day) => [day.isoDate, getDayTotalSeconds(entries, day.isoDate, nowMs)])),
        [week, entries, nowMs],
    );
    return (
        <section ref={sectionRef} aria-label="Weekly time entries" className="mt-6 rounded-lg border border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
            <div className="overflow-x-auto">
                <div className="min-w-[980px] p-3">
                    <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] gap-0">
                        <div />
                        {week.map((day) => (
                            <div key={day.isoDate} className={`border-b border-neutral-200 px-2 py-2 text-sm font-medium dark:border-neutral-700 ${day.isToday ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : ""}`}>
                                <span className="flex items-baseline justify-between gap-2">
                                    <span>
                                        {day.dayLabel} {day.dayNumber}
                                        {day.isToday ? <span className="ml-1 text-xs">Today</span> : null}
                                    </span>
                                    <span className="text-xs font-normal tabular-nums text-neutral-600 dark:text-neutral-400" aria-label={`Total ${formatDuration(dailyTotals.get(day.isoDate) ?? 0)}`}>
                                        {formatDuration(dailyTotals.get(day.isoDate) ?? 0)}
                                    </span>
                                </span>
                            </div>
                        ))}
                        <div ref={gutterRef} className="relative" style={{ height: dayHeight }}>
                            {HOURS.map((hour) => (
                                <div key={hour} className="absolute right-2 -translate-y-1/2 text-xs" style={{ top: hour * pixelsPerHour }}>
                                    {String(hour).padStart(2, "0")}:00
                                </div>
                            ))}
                        </div>
                        {week.map((day) => (
                            <div key={day.isoDate} className="relative overflow-hidden border-l border-neutral-200 dark:border-neutral-700" style={{ height: dayHeight }}>
                                {HOURS.map((hour) => (
                                    <div key={hour} className="absolute inset-x-0 border-t border-dashed border-neutral-200 dark:border-neutral-700" style={{ top: hour * pixelsPerHour }} />
                                ))}
                                {layoutDayEntries(entries, day.isoDate, nowMs, pixelsPerHour).map((entry) => (
                                    <article
                                        key={entry.id}
                                        title={`${entry.taskName} — ${formatDuration(entry.durationSeconds)}${entry.endedAt === null ? " (running)" : ""}`}
                                        role={onEntrySelect ? "button" : undefined}
                                        tabIndex={onEntrySelect ? 0 : undefined}
                                        aria-label={onEntrySelect ? `Edit ${entry.taskName}` : undefined}
                                        onClick={onEntrySelect ? () => onEntrySelect(entry.id) : undefined}
                                        onKeyDown={onEntrySelect ? (event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                onEntrySelect(entry.id);
                                            }
                                        } : undefined}
                                        className={`absolute overflow-hidden rounded border border-blue-200 bg-blue-100 px-1 text-xs text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 ${onEntrySelect ? "cursor-pointer hover:ring-2 hover:ring-blue-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600" : ""}`}
                                        style={{ top: entry.top, height: entry.height, left: `${entry.column * 100 / entry.totalColumns}%`, width: `${100 / entry.totalColumns}%` }}
                                    >
                                        <p className="truncate font-medium">{entry.taskName}</p>
                                        {entry.height >= 36 ? <p className="truncate">{formatDuration(entry.durationSeconds)}{entry.endedAt === null ? " · Running" : ""}</p> : null}
                                    </article>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
