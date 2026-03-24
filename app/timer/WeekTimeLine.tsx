import { TimeEntry, CalendarDay } from "./timer.types";
import { getMinutesSinceMidnight, sameLocalDate } from "./timer.utils";

type WeekTimelineProps = {
    week: CalendarDay[];
    entries: TimeEntry[];
};

type PositionedEntry = {
    id: string;
    taskName: string;
    top: number;
    height: number;
    column: number;
    totalColumns: number;
};
function layoutDayEntries(entries: TimeEntry[]): PositionedEntry[] {
    const MINUTES_PER_DAY = 24 * 60;
    const pixelsPerMinute = PIXELS_PER_HOUR / 60;
    const base = entries
        .map((entry) => {
            const start = Math.max(
                0,
                Math.min(getMinutesSinceMidnight(entry.startedAt), MINUTES_PER_DAY)
            );
            const rawEnd = entry.endedAt
                ? getMinutesSinceMidnight(entry.endedAt)
                : getMinutesSinceMidnight(new Date().toISOString());
            const end = Math.max(start + 1 / 60, Math.min(rawEnd, MINUTES_PER_DAY));
            return {
                id: entry.id,
                taskName: entry.taskName,
                start,
                end,
                top: start * pixelsPerMinute,
                height: Math.max(18, (end - start) * pixelsPerMinute),
            };
        })
        .sort((a, b) => (a.start - b.start) || (a.end - b.end));
    const active: Array<{ end: number; column: number }> = [];
    const clusterMaxCols: Record<number, number> = {};
    let clusterId = -1;
    const placed = base.map((item) => {

        for (let i = active.length - 1; i >= 0; i--) {
            if (active[i].end <= item.start) active.splice(i, 1);
        }

        if (active.length === 0) clusterId += 1;

        const used = new Set(active.map((a) => a.column));
        let column = 0;
        while (used.has(column)) column++;
        active.push({ end: item.end, column });
        const concurrent = active.length;
        clusterMaxCols[clusterId] = Math.max(clusterMaxCols[clusterId] ?? 1, concurrent);
        return { ...item, column, clusterId };
    });
    return placed.map((p) => ({
        id: p.id,
        taskName: p.taskName,
        top: p.top,
        height: p.height,
        column: p.column,
        totalColumns: clusterMaxCols[p.clusterId] ?? 1,
    }));
}

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
                            const positioned = layoutDayEntries(dayEntries);
                            return (
                                <div key={day.isoDate} className="relative border-l border-neutral-200" style={{ height: DAY_HEIGHT }}>
                                    {Array.from({ length: 25 }, (_, hour) => (
                                        <div
                                            key={hour}
                                            className="absolute inset-x-0 border-t border-dashed border-neutral-200"
                                            style={{ top: hour * PIXELS_PER_HOUR }}
                                        />
                                    ))}
                                    {positioned.map((entry) => {
                                        const widthPct = 100 / entry.totalColumns;
                                        const leftPct = entry.column * widthPct;
                                        return (
                                            <article
                                                key={entry.id}
                                                className="absolute rounded border border-blue-200 bg-blue-100 px-2 py-1 text-xs"
                                                style={{
                                                    top: entry.top,
                                                    height: entry.height,
                                                    left: `${leftPct}%`,
                                                    width: `${widthPct}%`,
                                                }}
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