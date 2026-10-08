import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WeekTimeline } from "@/app/timer/WeekTimeLine";
import { getWeekFromDate } from "@/app/timer/timer.utils";

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

it("fits the timeline below the controls and keeps entries aligned after resizing or reflow", async () => {
    let gutterTop = 330;
    let resized!: ResizeObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class {
        constructor(callback: ResizeObserverCallback) { resized = callback; }
        observe = vi.fn();
        disconnect = disconnect;
    });
    vi.stubGlobal("innerHeight", 768);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
        const gutter = this.tagName === "SECTION" ? this.querySelector<HTMLElement>("[style]") : this;
        const height = parseFloat(gutter?.style.height ?? "0") || 0;
        return { top: gutterTop, bottom: gutterTop + height + (this.tagName === "SECTION" ? 13 : 0) } as DOMRect;
    });

    const day = new Date(2026, 9, 5, 12);
    const { unmount } = render(
        <main style={{ paddingBottom: 24 }}>
            <WeekTimeline week={getWeekFromDate(day, day)} nowMs={day.getTime()} entries={[{
                id: "entry-1",
                taskName: "Morning work",
                startedAt: new Date(2026, 9, 5, 9).toISOString(),
                endedAt: new Date(2026, 9, 5, 10, 30).toISOString(),
            }]} />
        </main>,
    );
    const block = screen.getByText("Morning work").closest("article")!;
    const column = block.parentElement!;
    await waitFor(() => expect(column.style.height).toBe("400px"));
    expect(parseFloat(block.style.top)).toBeCloseTo(150);
    expect(parseFloat(block.style.height)).toBeCloseTo(25);
    expect(gutterTop + parseFloat(column.style.height) + 13 + 24).toBeLessThanOrEqual(window.innerHeight);
    expect(screen.getAllByText(/^\d{2}:00$/).map((label) => label.textContent)).toEqual([
        "00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00",
        "14:00", "16:00", "18:00", "20:00", "22:00", "24:00",
    ]);

    vi.stubGlobal("innerHeight", 1080);
    fireEvent(window, new Event("resize"));
    await waitFor(() => expect(column.style.height).toBe("712px"));
    expect(parseFloat(block.style.top)).toBeCloseTo(267);

    gutterTop = 400;
    act(() => resized([], {} as ResizeObserver));
    await waitFor(() => expect(column.style.height).toBe("642px"));
    expect(parseFloat(block.style.top)).toBeCloseTo(240.75);
    expect(gutterTop + parseFloat(column.style.height) + 13 + 24).toBeLessThanOrEqual(window.innerHeight);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
});
