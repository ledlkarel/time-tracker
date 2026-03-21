import { CalendarDay } from "./timer.types";
type WeekDatePickerProps = {
    week: CalendarDay[];
    selectedDate: string;
    onSelectDate: (isoDate: string) => void;
};
export function WeekDatePicker({
    week,
    selectedDate,
    onSelectDate,
}: WeekDatePickerProps) {
    return (
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {week.map((day) => {
                const isSelected = selectedDate === day.isoDate;
                return (
                    <button
                        key={day.isoDate}
                        type="button"
                        onClick={() => onSelectDate(day.isoDate)}
                        className={`rounded-lg border px-3 py-4 text-left transition ${isSelected
                                ? "border-blue-600 bg-blue-50"
                                : "border-neutral-200 bg-white hover:border-neutral-400"
                            }`}
                    >
                        <p className="text-xs text-neutral-500">{day.dayLabel}</p>
                        <p className="mt-1 text-xl font-semibold text-neutral-400">{day.dayNumber}</p>
                        {day.isToday ? (
                            <p className="mt-2 text-xs font-medium text-blue-700">Today</p>
                        ) : null}
                    </button>
                );
            })}
        </section>
    );
}