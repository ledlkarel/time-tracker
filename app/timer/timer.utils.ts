import { CalendarDay } from "./timer.types";

export function getCurrentWeek(): CalendarDay[] {
    const today = new Date();
    const monday = new Date(today);
    const dayOfWeek = monday.getDay();
    const daysFromMonday = (dayOfWeek + 6) % 7;
    monday.setDate(monday.getDate() - daysFromMonday);
    return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + index);
        return {
            isoDate: day.toISOString().slice(0, 10),
            dayLabel: day.toLocaleDateString(undefined, { weekday: "short" }),
            dayNumber: day.toLocaleDateString(undefined, { day: "2-digit" }),
            isToday: day.toDateString() === today.toDateString(),
        };
    });
}

export function toLocalIsoDate(value: string): string {
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