import { TimeEntry, CalendarDay } from "./timer.types";
import { getMinutesSinceMidnight, sameLocalDate } from "./timer.utils";

type WeekTimelineProps = {
    week: CalendarDay[];
    entries: TimeEntry[];
};

const PIXELS_PER_HOUR = 56;
const DAY_HEIGHT = 24 * PIXELS_PER_HOUR;
export function WeekTimeline({ week, entries }: WeekTimelineProps) {
    return (
        <section className="mt-6 rounded-lg border border-neutral-200 bg-white">
            <div className="overflow-x-auto">
                <div className="min-w-[980px] p-3">
                    <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] gap-0">
                        <div />
                        {week.map((day) => (
                            <div key={day.isoDate} className="border-b border-neutral-200 px-2 py-2 text-sm font-medium text-neutral-900">
                                {day.dayLabel} {day.dayNumber}
                            </div>
                        ))}
                        <div className="relative" style={{ height: DAY_HEIGHT }}>
                            {Array.from({ length: 25 }, (_, hour) => (
                                <div
                                    key={hour}
                                    className="absolute right-2 -translate-y-1/2 text-xs text-neutral-900"
                                    style={{ top: hour * PIXELS_PER_HOUR }}
                                >
                                    {String(hour).padStart(2, "0")}:00
                                </div>
                            ))}
                        </div>
                        {week.map((day) => {
                            const dayEntries = entries.filter((e) => sameLocalDate(e.startedAt, day.isoDate));
                            return (
                                <div key={day.isoDate} className="relative border-l border-neutral-200" style={{ height: DAY_HEIGHT }}>
                                    {Array.from({ length: 25 }, (_, hour) => (
                                        <div
                                            key={hour}
                                            className="absolute inset-x-0 border-t border-dashed border-neutral-200"
                                            style={{ top: hour * PIXELS_PER_HOUR }}
                                        />
                                    ))}
                                    {dayEntries.map((entry) => {
                                        const start = getMinutesSinceMidnight(entry.startedAt);
                                        const end = entry.endedAt
                                            ? getMinutesSinceMidnight(entry.endedAt)
                                            : getMinutesSinceMidnight(new Date().toISOString());
                                        const top = (start / 60) * PIXELS_PER_HOUR;
                                        const height = Math.max(18, ((end - start) / 60) * PIXELS_PER_HOUR);
                                        return (
                                            <article
                                                key={entry.id}
                                                className="absolute left-1 right-1 rounded border border-blue-200 bg-blue-100 px-2 py-1 text-xs"
                                                style={{ top, height }}
                                            >
                                                <p className="truncate font-medium text-blue-900">{entry.taskName}</p>
                                            </article>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}