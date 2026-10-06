import type { CalendarDay } from "./timer.types";

export function getWeekFromDate(baseDate: Date, today = new Date()): CalendarDay[] {
    const monday = new Date(baseDate);
    monday.setHours(12, 0, 0, 0);
    const dayOfWeek = monday.getDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + index);
        return {
            isoDate: toLocalIsoDate(day),
            dayLabel: day.toLocaleDateString(undefined, { weekday: "short" }),
            dayNumber: day.toLocaleDateString(undefined, { day: "2-digit" }),
            isToday: day.toDateString() === today.toDateString(),
        };
    });
}
export function getCurrentWeek(): CalendarDay[] {
    return getWeekFromDate(new Date());
}

export function toLocalIsoDate(value: string | Date): string {
    const source = new Date(value);
    const year = source.getFullYear();
    const month = String(source.getMonth() + 1).padStart(2, "0");
    const day = String(source.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function sameLocalDate(isoDateTime: string, isoDate: string): boolean {
    return toLocalIsoDate(isoDateTime) === isoDate;
}

export function getMinutesSinceMidnight(value: string): number {
    const source = new Date(value);
    return source.getHours() * 60 + source.getMinutes() + source.getSeconds() / 60;
}

export function getDayBounds(isoDate: string): { start: Date; end: Date } {
    const start = new Date(`${isoDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
}

export function getWeekBounds(week: CalendarDay[]): { start: string; end: string } {
    return {
        start: getDayBounds(week[0].isoDate).start.toISOString(),
        end: getDayBounds(week[week.length - 1].isoDate).end.toISOString(),
    };
}
