// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { DAY_HEIGHT, layoutDayEntries, PIXELS_PER_HOUR, segmentEntryForDay } from "@/app/timer/timeline.utils";
import { fromLocalDateTimeInput, getDayBounds, getWeekBounds, getWeekFromDate, toLocalDateTimeInput, toLocalIsoDate } from "@/app/timer/timer.utils";
import type { TimeEntry } from "@/app/timer/timer.types";

const originalTZ = process.env.TZ;
afterEach(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
});

function entry(startedAt: string, endedAt: string | null, id = "1"): TimeEntry {
    return { id, taskName: "Task", startedAt, endedAt };
}

describe.each(["Pacific/Kiritimati", "America/Los_Angeles", "Asia/Kolkata"])("local dates in %s", (zone) => {
    it("keeps week labels, ISO dates, and query boundaries in agreement near midnight", () => {
        process.env.TZ = zone;
        for (const hour of [0, 23]) {
            const base = new Date(2026, 9, 5, hour, 30);
            const week = getWeekFromDate(base, base);
            expect(week.map((day) => day.isoDate)).toEqual([
                "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
            ]);
            expect(week[0].isToday).toBe(true);
            expect(toLocalIsoDate(base)).toBe("2026-10-05");
            expect(getWeekBounds(week)).toEqual({
                start: new Date(2026, 9, 5).toISOString(),
                end: new Date(2026, 9, 12).toISOString(),
            });
        }
    });
});

it("handles a Sunday in a week crossing the year boundary", () => {
    process.env.TZ = "UTC";
    const week = getWeekFromDate(new Date("2027-01-03T12:00:00Z"));
    expect(week[0].isoDate).toBe("2026-12-28");
    expect(week[6].isoDate).toBe("2027-01-03");
});

it("round-trips local datetime input values", () => {
    process.env.TZ = "America/New_York";
    const source = "2026-10-05T14:23:45-04:00";
    const input = toLocalDateTimeInput(source);
    expect(input).toBe("2026-10-05T14:23:45");
    expect(fromLocalDateTimeInput(input)).toBe("2026-10-05T18:23:45.000Z");
});

it("rejects invalid and nonexistent local datetime input values", () => {
    process.env.TZ = "America/New_York";
    expect(fromLocalDateTimeInput("not-a-date")).toBeNull();
    expect(fromLocalDateTimeInput("2026-02-30T10:00:00")).toBeNull();
    expect(fromLocalDateTimeInput("2026-03-08T02:30:00")).toBeNull();
});

it("splits overnight entries and excludes days that only touch a boundary", () => {
    process.env.TZ = "UTC";
    const overnight = entry("2026-10-04T23:00:00Z", "2026-10-05T01:00:00Z");
    const sunday = segmentEntryForDay(overnight, "2026-10-04", 0);
    const monday = segmentEntryForDay(overnight, "2026-10-05", 0);
    expect(sunday).toMatchObject({ top: 23 * PIXELS_PER_HOUR, height: PIXELS_PER_HOUR, durationSeconds: 3600 });
    expect(monday).toMatchObject({ top: 0, height: PIXELS_PER_HOUR, durationSeconds: 3600 });
    expect(segmentEntryForDay(overnight, "2026-10-06", 0)).toBeNull();
    expect(segmentEntryForDay(entry(overnight.startedAt, "2026-10-05T00:00:00Z"), "2026-10-05", 0)).toBeNull();
});

it("updates running segments using the supplied clock across multiple days", () => {
    process.env.TZ = "UTC";
    const running = entry("2026-10-04T23:00:00Z", null);
    const now = Date.parse("2026-10-06T02:00:00Z");
    expect(segmentEntryForDay(running, "2026-10-05", now)).toMatchObject({ top: 0, height: DAY_HEIGHT, durationSeconds: 86400, endedAt: "2026-10-06T00:00:00.000Z" });
    expect(segmentEntryForDay(running, "2026-10-06", now)).toMatchObject({ top: 0, height: 112, durationSeconds: 7200, endedAt: null });
    expect(segmentEntryForDay(running, "2026-10-06", now + 3600000)?.durationSeconds).toBe(10800);
});

it.each([
    ["2026-03-08", 23],
    ["2026-11-01", 25],
])("uses actual elapsed time on the DST transition %s", (date, hours) => {
    process.env.TZ = "America/New_York";
    const { start, end } = getDayBounds(date);
    expect((end.getTime() - start.getTime()) / 3600000).toBe(hours);
    const segment = segmentEntryForDay(entry(start.toISOString(), end.toISOString()), date, 0);
    expect(segment).toMatchObject({ top: 0, height: DAY_HEIGHT, durationSeconds: hours * 3600 });
});

it("renders a repeated-hour entry with positive duration and bounded geometry", () => {
    process.env.TZ = "America/New_York";
    const segment = segmentEntryForDay(entry("2026-11-01T01:50:00-04:00", "2026-11-01T01:10:00-05:00"), "2026-11-01", 0);
    expect(segment?.durationSeconds).toBe(1200);
    expect(segment?.height).toBeGreaterThan(0);
});

it("keeps short entries inside the grid and separates visual overlaps", () => {
    process.env.TZ = "UTC";
    const positioned = layoutDayEntries([
        entry("2026-10-05T23:59:00Z", "2026-10-05T23:59:10Z", "1"),
        entry("2026-10-05T23:59:20Z", "2026-10-05T23:59:30Z", "2"),
    ], "2026-10-05", 0);
    expect(positioned).toHaveLength(2);
    expect(positioned.map((item) => item.column)).toEqual([0, 1]);
    for (const item of positioned) {
        expect(item.totalColumns).toBe(2);
        expect(item.top + item.height).toBeLessThanOrEqual(DAY_HEIGHT);
    }
});

it("rejects invalid and reversed timestamps rather than rendering corrupt blocks", () => {
    process.env.TZ = "UTC";
    expect(segmentEntryForDay(entry("invalid", null), "2026-10-05", Date.now())).toBeNull();
    expect(segmentEntryForDay(entry("2026-10-05T12:00:00Z", "2026-10-05T11:00:00Z"), "2026-10-05", 0)).toBeNull();
});
