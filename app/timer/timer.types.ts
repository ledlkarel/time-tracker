export type TimeEntry = {
    id: string;
    startedAt: string;
    endedAt: string | null;
};

export type CalendarDay = {
    isoDate: string;
    dayLabel: string;
    dayNumber: string;
    isToday: boolean;
};

export type TimelineSegment = {
    id: string;
    top: number;
    height: number;
    startedAt: string;
    endedAt: string | null;
    durationSeconds: number;
};