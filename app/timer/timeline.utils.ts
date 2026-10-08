import type { TimeEntry, TimelineSegment } from "./timer.types";
import { getDayBounds, getMinutesSinceMidnight } from "./timer.utils";

export const PIXELS_PER_HOUR = 56;
export const DAY_HEIGHT = 24 * PIXELS_PER_HOUR;
const MIN_HEIGHT = 18;

export type PositionedEntry = TimelineSegment & {
    column: number;
    totalColumns: number;
};

// Calendar coordinates use local wall time; durations use elapsed time (including DST).
export function segmentEntryForDay(
    entry: TimeEntry,
    isoDate: string,
    nowMs: number,
    pixelsPerHour = PIXELS_PER_HOUR,
): TimelineSegment | null {
    const { start: dayStart, end: dayEnd } = getDayBounds(isoDate);
    const entryStart = Date.parse(entry.startedAt);
    const entryEnd = entry.endedAt === null ? nowMs : Date.parse(entry.endedAt);
    if (!Number.isFinite(entryStart) || !Number.isFinite(entryEnd)) return null;

    const start = Math.max(entryStart, dayStart.getTime());
    const end = Math.min(entryEnd, dayEnd.getTime());
    if (end <= start) return null;

    const startedAt = new Date(start).toISOString();
    const endedAt = new Date(end).toISOString();
    const startMinute = start === dayStart.getTime() ? 0 : getMinutesSinceMidnight(startedAt);
    const endMinute = end === dayEnd.getTime() ? 1440 : getMinutesSinceMidnight(endedAt);
    const dayHeight = 24 * pixelsPerHour;
    const pixelsPerMinute = pixelsPerHour / 60;
    const height = Math.min(dayHeight, Math.max(MIN_HEIGHT, (endMinute - startMinute) * pixelsPerMinute));
    const top = Math.min(startMinute * pixelsPerMinute, dayHeight - height);

    return {
        id: entry.id,
        taskName: entry.taskName,
        startedAt,
        endedAt: entry.endedAt === null && end === nowMs ? null : endedAt,
        durationSeconds: Math.floor((end - start) / 1000),
        top,
        height,
    };
}

export function getDayTotalSeconds(entries: TimeEntry[], isoDate: string, nowMs: number): number {
    return entries.reduce((total, entry) => {
        const segment = segmentEntryForDay(entry, isoDate, nowMs);
        return total + (segment?.durationSeconds ?? 0);
    }, 0);
}

export function layoutDayEntries(entries: TimeEntry[], isoDate: string, nowMs: number, pixelsPerHour = PIXELS_PER_HOUR): PositionedEntry[] {
    const segments = entries
        .map((entry) => segmentEntryForDay(entry, isoDate, nowMs, pixelsPerHour))
        .filter((segment): segment is TimelineSegment => segment !== null)
        .sort((a, b) => a.top - b.top || a.height - b.height);

    const active: Array<{ bottom: number; column: number }> = [];
    const clusterWidths: number[] = [];
    let cluster = -1;
    const placed = segments.map((segment) => {
        // Include minimum rendered heights so short adjacent tasks don't obscure each other.
        for (let index = active.length - 1; index >= 0; index--) {
            if (active[index].bottom <= segment.top) active.splice(index, 1);
        }
        if (active.length === 0) cluster++;
        const used = new Set(active.map((item) => item.column));
        let column = 0;
        while (used.has(column)) column++;
        active.push({ bottom: segment.top + segment.height, column });
        clusterWidths[cluster] = Math.max(clusterWidths[cluster] ?? 1, column + 1);
        return { ...segment, column, cluster };
    });
    return placed.map(({ cluster, ...segment }) => ({
        ...segment,
        totalColumns: clusterWidths[cluster],
    }));
}
