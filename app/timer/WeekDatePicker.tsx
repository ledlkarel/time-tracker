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
        <section className="mt-6 grid grid-cols-7 gap-2">
            {week.map((day) => {
                const isSelected = selectedDate === day.isoDate;
                return (
                    <button
                        key={day.isoDate}
                        type="button"
                        onClick={() => onSelectDate(day.isoDate)}
                        className={`rounded-lg border px-1 py-3 text-center transition sm:px-3 sm:text-left ${
                            isSelected
                                ? "border-blue-600 bg-blue-50"
                                : "border-neutral-200 bg-white hover:border-neutral-400"
                        }`}
                    >
                        <p className="text-[11px] text-neutral-500 sm:text-xs">{day.dayLabel}</p>
                        <p className="mt-1 text-base font-semibold text-neutral-700 sm:text-xl">{day.dayNumber}</p>
                        {day.isToday ? (
                            <p className="mt-1 text-[10px] font-medium text-blue-700 sm:mt-2 sm:text-xs">Today</p>
                        ) : null}
                    </button>
                );
            })}
        </section>
    );
}