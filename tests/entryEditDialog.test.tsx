import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EntryEditDialog } from "@/app/timer/EntryEditDialog";
import { WeekTimeline } from "@/app/timer/WeekTimeLine";
import { getWeekFromDate, toLocalDateTimeInput } from "@/app/timer/timer.utils";
import type { TimeEntry } from "@/app/timer/timer.types";

afterEach(cleanup);

const completedEntry = (): TimeEntry => ({
    id: "entry-1",
    taskName: "Original title",
    startedAt: new Date(2026, 9, 5, 9, 30, 15).toISOString(),
    endedAt: new Date(2026, 9, 5, 11, 0, 0).toISOString(),
});

it("prefills the entry and saves its title, start, and end time", async () => {
    const entry = completedEntry();
    const onSave = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<EntryEditDialog entry={entry} nowMs={Date.now()} isSaving={false} onClose={onClose} onSave={onSave} />);
    expect(screen.getByLabelText("Title")).toHaveProperty("value", "Original title");
    expect((screen.getByLabelText("Started at") as HTMLInputElement).value).toBe(`${toLocalDateTimeInput(entry.startedAt)}.000`);
    expect((screen.getByLabelText("Ended at") as HTMLInputElement).value).toBe(toLocalDateTimeInput(entry.endedAt!).slice(0, 16));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: " Revised title " } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("entry-1", { startedAt: entry.startedAt, endedAt: entry.endedAt, taskName: "Revised title" }));
    expect(onClose).toHaveBeenCalled();
});

it("blocks an end time before its start", async () => {
    const entry = completedEntry();
    const onSave = vi.fn();
    render(<EntryEditDialog entry={entry} nowMs={Date.now()} isSaving={false} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Ended at"), { target: { value: "2026-10-05T08:00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toContain("End time cannot be before the start time.");
    expect(onSave).not.toHaveBeenCalled();
});

it("hides the end time field and keeps running entries active", async () => {
    const entry = { ...completedEntry(), endedAt: null };
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EntryEditDialog entry={entry} nowMs={Date.now()} isSaving={false} onClose={vi.fn()} onSave={onSave} />);
    expect(screen.queryByLabelText("Ended at")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("entry-1", { startedAt: entry.startedAt, endedAt: null, taskName: entry.taskName }));
});

it("does not allow clearing the end time of a completed entry", async () => {
    const onSave = vi.fn();
    render(<EntryEditDialog entry={completedEntry()} nowMs={Date.now()} isSaving={false} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Ended at"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toContain("must keep an end time");
    expect(onSave).not.toHaveBeenCalled();
});

it("allows a future end time", async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<EntryEditDialog entry={completedEntry()} nowMs={Date.now()} isSaving={false} onClose={vi.fn()} onSave={onSave} />);
    const futureEnd = toLocalDateTimeInput(new Date(Date.now() + 3600000));
    fireEvent.change(screen.getByLabelText("Ended at"), { target: { value: futureEnd } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("entry-1", expect.objectContaining({ endedAt: new Date(futureEnd).toISOString() })));
    expect(screen.queryByRole("alert")).toBeNull();
});

it("blocks future start times for running entries", async () => {
    const entry = { ...completedEntry(), endedAt: null };
    const onSave = vi.fn();
    const future = new Date(Date.now() + 3600000);
    render(<EntryEditDialog entry={entry} nowMs={Date.now()} isSaving={false} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Started at"), { target: { value: toLocalDateTimeInput(future) } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toContain("cannot start in the future");
    expect(onSave).not.toHaveBeenCalled();
});

it("closes with Escape when it is not saving", () => {
    const onClose = vi.fn();
    render(<EntryEditDialog entry={completedEntry()} nowMs={Date.now()} isSaving={false} onClose={onClose} onSave={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
});

it("selects timeline entries with pointer and keyboard input", () => {
    const entry = completedEntry();
    const onEntrySelect = vi.fn();
    const week = getWeekFromDate(new Date(2026, 9, 5, 12));
    const { rerender } = render(<WeekTimeline week={week} entries={[entry]} nowMs={Date.now()} onEntrySelect={onEntrySelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Original title" }));
    expect(onEntrySelect).toHaveBeenLastCalledWith("entry-1");
    onEntrySelect.mockClear();
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit Original title" }), { key: "Enter" });
    expect(onEntrySelect).toHaveBeenLastCalledWith("entry-1");
    rerender(<WeekTimeline week={week} entries={[entry]} nowMs={Date.now()} onEntrySelect={onEntrySelect} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Edit Original title" }), { key: " " });
    expect(onEntrySelect).toHaveBeenLastCalledWith("entry-1");
});
