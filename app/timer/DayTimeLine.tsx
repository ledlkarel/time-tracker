import { formatDuration } from "@/lib/time";
import { useMemo } from "react";
import { TimeEntry, TimelineSegment } from "./timer.types";
import { getMinutesSinceMidnight } from "./timer.utils";

type DayTimelineProps = {
    selectedDate: string;
    entries: TimeEntry[];
};

export function DayTimeline({ selectedDate, entries }: DayTimelineProps) {
    const timelineSegments = useMemo<TimelineSegment[]>(() => {
        const MINUTES_PER_DAY = 24 * 60;
        const PIXELS_PER_HOUR = 56;
        const PIXELS_PER_MINUTE = PIXELS_PER_HOUR / 60;
        return entries
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
                const durationSeconds = Math.max(1, Math.floor((clampedEnd - clampedStart) * 60));
                return {
                    id: entry.id,
                    top: clampedStart * PIXELS_PER_MINUTE,
                    height: (clampedEnd - clampedStart) * PIXELS_PER_MINUTE,
                    startedAt: entry.startedAt,
                    endedAt: entry.endedAt,
                    durationSeconds,
                    taskName : entry.taskName
                };
            })
            .sort((a, b) => a.top - b.top);
    }, [entries]);
    const timelineHeight = 24 * 56;
    return (
        <section className="mt-6">
            <h2 className="text-lg font-semibold">Day timeline for {selectedDate}</h2>
            {entries.length === 0 ? (
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
                                        <p className="font-medium text-blue-900">{entry.taskName}</p>
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
    );
}