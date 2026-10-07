import { StrictMode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useTimerEntries } from "@/app/timer/useTimerEntries";

const client = vi.hoisted(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn(), onAuthStateChange: vi.fn() },
}));
vi.mock("@/src/lib/supabase/client", () => ({ createClient: () => client }));

type Row = { id: string; started_at: string; ended_at: string | null; task_name: string };
type Response = { data: Row[] | Row | null; error: { message: string; code?: string } | null };
type Request = {
    kind: "week" | "active" | "insert" | "update";
    filters: Record<string, unknown>;
    values?: Record<string, unknown>;
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

const respond = vi.fn<(request: Request) => Response | Promise<Response>>();
let authChanged: (event: string, session: { user: { id: string } } | null) => void;
let active: Row | null;
let weekRows: Row[];

function query() {
    const request: Request = { kind: "week", filters: {} };
    const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => { request.filters[key] = value; return builder; },
        is: (key: string, value: unknown) => {
            if (request.kind === "week") request.kind = "active";
            request.filters[key] = value;
            return builder;
        },
        lt: (key: string, value: unknown) => { request.filters[`${key}.lt`] = value; return builder; },
        or: (value: string) => { request.filters.or = value; return builder; },
        order: () => builder,
        limit: () => builder,
        insert: (values: Record<string, unknown>) => { request.kind = "insert"; request.values = values; return builder; },
        update: (values: Record<string, unknown>) => { request.kind = "update"; request.values = values; return builder; },
        single: () => builder,
        maybeSingle: () => builder,
        then: <T, U>(yes?: (value: Response) => T | PromiseLike<T>, no?: (reason: unknown) => U | PromiseLike<U>) => Promise.resolve().then(() => respond(request)).then(yes, no),
    };
    return builder;
}

beforeEach(() => {
    active = null;
    weekRows = [];
    client.from.mockImplementation(query);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    client.auth.onAuthStateChange.mockImplementation((callback) => {
        authChanged = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    respond.mockImplementation((request) => {
        if (request.kind === "active") return { data: active ? [active] : [], error: null };
        if (request.kind === "week") return { data: weekRows, error: null };
        throw new Error("Unexpected mutation");
    });
});
afterEach(cleanup);

const runningRow = (): Row => ({ id: "timer-1", started_at: new Date(Date.now() - 3600000).toISOString(), ended_at: null, task_name: "Task" });

it("blocks Start until the independent active-timer lookup completes", async () => {
    const lookup = deferred<Response>();
    respond.mockImplementation((request) => request.kind === "active" ? lookup.promise : { data: [], error: null });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(respond).toHaveBeenCalled());
    expect(result.current.isTimerReady).toBe(false);
    await act(async () => { expect(await result.current.handleStart("Task")).toBe(false); });
    expect(respond.mock.calls.some(([request]) => request.kind === "insert")).toBe(false);
    await act(async () => { lookup.resolve({ data: [], error: null }); });
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
});

it("keeps an active timer from a different week when navigating", async () => {
    active = { ...runningRow(), started_at: "2025-01-01T12:00:00Z" };
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    const weekStart = result.current.week[0].isoDate;
    act(() => result.current.goToPreviousWeek());
    await waitFor(() => expect(result.current.isLoadingEntries).toBe(false));
    expect(result.current.week[0].isoDate).not.toBe(weekStart);
    expect(result.current.runningEntryId).toBe("timer-1");
    await act(async () => { expect(await result.current.handleStart("Second task")).toBe(false); });
    expect(respond.mock.calls.filter(([request]) => request.kind === "active")).toHaveLength(1);
});

it("ignores an older week response after navigating to a newer one", async () => {
    const oldWeek = deferred<Response>();
    let weekRequests = 0;
    const newer = { ...runningRow(), id: "newer", ended_at: new Date().toISOString() };
    respond.mockImplementation((request) => {
        if (request.kind === "active") return { data: [], error: null };
        return ++weekRequests === 1 ? oldWeek.promise : { data: [newer], error: null };
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(weekRequests).toBe(1));
    act(() => result.current.goToNextWeek());
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("newer"));
    await act(async () => { oldWeek.resolve({ data: [{ ...newer, id: "older" }], error: null }); });
    expect(result.current.entries[0]?.id).toBe("newer");
});

it("guards duplicate starts and ignores a fetch begun before a mutation", async () => {
    const oldWeek = deferred<Response>();
    const insertion = deferred<Response>();
    let weekRequests = 0;
    respond.mockImplementation((request) => {
        if (request.kind === "insert") return insertion.promise;
        if (request.kind === "active") return { data: active ? [active] : [], error: null };
        return ++weekRequests === 1 ? oldWeek.promise : { data: active ? [active] : [], error: null };
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    let start!: Promise<boolean>;
    await act(async () => {
        start = result.current.handleStart(" Task ");
        expect(await result.current.handleStart("Duplicate")).toBe(false);
    });
    expect(result.current.isSaving).toBe(true);
    active = runningRow();
    await act(async () => { insertion.resolve({ data: active, error: null }); expect(await start).toBe(true); });
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("timer-1"));
    await act(async () => { oldWeek.resolve({ data: [], error: null }); });
    expect(result.current.entries[0]?.id).toBe("timer-1");
    const inserts = respond.mock.calls.filter(([request]) => request.kind === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0][0].values).toMatchObject({ user_id: "user-1", task_name: "Task" });
    expect(result.current.isSaving).toBe(false);
});

it("does not claim Stop succeeded if no owned running row was updated", async () => {
    active = runningRow();
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => request.kind === "update" ? { data: null, error: null } : read(request));
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    await act(async () => { expect(await result.current.handleStop()).toBe(false); });
    expect(result.current.errorMessage).toContain("already stopped");
    expect(result.current.runningEntryId).toBe("timer-1");
    expect(result.current.isSaving).toBe(false);
    const update = respond.mock.calls.find(([request]) => request.kind === "update")![0];
    expect(update.filters).toEqual({ id: "timer-1", user_id: "user-1", ended_at: null });
});

it("edits a completed entry with an ownership filter", async () => {
    const startedAt = new Date(Date.now() - 7200000).toISOString();
    const completed: Row = { id: "completed-1", started_at: startedAt, ended_at: new Date(Date.now() - 3600000).toISOString(), task_name: "Old title" };
    weekRows = [completed];
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "update") {
            weekRows = [{ ...completed, started_at: request.values!.started_at as string, ended_at: request.values!.ended_at as string, task_name: request.values!.task_name as string }];
            return { data: weekRows[0], error: null };
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("completed-1"));
    const nextStart = new Date(Date.now() - 5400000).toISOString();
    await act(async () => {
        expect(await result.current.handleEdit("completed-1", { startedAt: nextStart, endedAt: completed.ended_at, taskName: " Updated title " })).toBe(true);
    });
    await waitFor(() => expect(result.current.entries[0]?.taskName).toBe("Updated title"));
    expect(result.current.entries[0].startedAt).toBe(nextStart);
    const update = respond.mock.calls.find(([request]) => request.kind === "update")![0];
    expect(update.filters).toEqual({ id: "completed-1", user_id: "user-1" });
    expect(update.values).toEqual({ started_at: nextStart, ended_at: completed.ended_at, task_name: "Updated title" });
});

it("edits a running entry and recalculates its duration", async () => {
    active = runningRow();
    weekRows = [active];
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "update") {
            active = { ...active!, started_at: request.values!.started_at as string, ended_at: request.values!.ended_at as string | null, task_name: request.values!.task_name as string };
            weekRows = [active];
            return { data: active, error: null };
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    const nextStart = new Date(Date.now() - 7200000).toISOString();
    await act(async () => {
        expect(await result.current.handleEdit("timer-1", { startedAt: nextStart, endedAt: null, taskName: "Running edit" })).toBe(true);
    });
    expect(result.current.runningDurationSeconds).toBeGreaterThanOrEqual(7199);
    await waitFor(() => expect(result.current.entries[0]?.taskName).toBe("Running edit"));
});

it("stops a running entry at a custom end time through edit", async () => {
    active = runningRow();
    weekRows = [active];
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "update") {
            const stopped = { ...active!, ended_at: request.values!.ended_at as string };
            active = null;
            weekRows = [stopped];
            return { data: stopped, error: null };
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    const endedAt = new Date(Date.now() - 60000).toISOString();
    await act(async () => {
        expect(await result.current.handleEdit("timer-1", { startedAt: active!.started_at, endedAt, taskName: "Stopped manually" })).toBe(true);
    });
    expect(result.current.runningEntryId).toBeNull();
    expect(result.current.runningDurationSeconds).toBe(0);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    expect(result.current.entries[0].endedAt).toBe(endedAt);
});

it("rejects invalid edit times before sending an update", async () => {
    active = runningRow();
    weekRows = [active];
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    await act(async () => {
        expect(await result.current.handleEdit("timer-1", { startedAt: "invalid", endedAt: null, taskName: "Task" })).toBe(false);
        expect(await result.current.handleEdit("timer-1", { startedAt: new Date(Date.now() + 3600000).toISOString(), endedAt: null, taskName: "Task" })).toBe(false);
    });
    expect(respond.mock.calls.some(([request]) => request.kind === "update")).toBe(false);
    expect(result.current.errorMessage).toContain("cannot start in the future");
});

it("rejects clearing or reversing a completed end time", async () => {
    const completed: Row = { id: "completed-1", started_at: new Date(Date.now() - 7200000).toISOString(), ended_at: new Date(Date.now() - 3600000).toISOString(), task_name: "Task" };
    weekRows = [completed];
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("completed-1"));
    await act(async () => {
        expect(await result.current.handleEdit("completed-1", { startedAt: completed.started_at, endedAt: null, taskName: "Task" })).toBe(false);
        expect(await result.current.handleEdit("completed-1", { startedAt: completed.started_at, endedAt: new Date(Date.parse(completed.started_at) - 1000).toISOString(), taskName: "Task" })).toBe(false);
    });
    expect(respond.mock.calls.some(([request]) => request.kind === "update")).toBe(false);
    expect(result.current.errorMessage).toContain("End time cannot be before the start time");
});

it("allows a future end time through edit", async () => {
    const completed: Row = { id: "completed-1", started_at: new Date(Date.now() - 7200000).toISOString(), ended_at: new Date(Date.now() - 3600000).toISOString(), task_name: "Task" };
    weekRows = [completed];
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "update") {
            const updated = { ...completed, ended_at: request.values!.ended_at as string };
            weekRows = [updated];
            return { data: updated, error: null };
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("completed-1"));
    const futureEnd = new Date(Date.now() + 3600000).toISOString();
    await act(async () => {
        expect(await result.current.handleEdit("completed-1", { startedAt: completed.started_at, endedAt: futureEnd, taskName: "Task" })).toBe(true);
    });
    await waitFor(() => expect(result.current.entries[0]?.endedAt).toBe(futureEnd));
    expect(respond.mock.calls.find(([request]) => request.kind === "update")![0].values).toEqual({ started_at: completed.started_at, ended_at: futureEnd, task_name: "Task" });
});

it("keeps an entry unchanged when an edit updates no owned row", async () => {
    const completed: Row = { id: "completed-1", started_at: new Date(Date.now() - 7200000).toISOString(), ended_at: new Date(Date.now() - 3600000).toISOString(), task_name: "Original" };
    weekRows = [completed];
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => request.kind === "update" ? { data: null, error: null } : read(request));
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.entries[0]?.id).toBe("completed-1"));
    await act(async () => {
        expect(await result.current.handleEdit("completed-1", { startedAt: completed.started_at, endedAt: completed.ended_at, taskName: "Changed" })).toBe(false);
    });
    expect(result.current.entries[0].taskName).toBe("Original");
    expect(result.current.errorMessage).toContain("not found");
    expect(result.current.isSaving).toBe(false);
});

it("blocks a second start even through a stale handler after the first resolves", async () => {
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "insert") {
            active = runningRow();
            return { data: active, error: null };
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    const start = result.current.handleStart;
    await act(async () => {
        expect(await start("First")).toBe(true);
        expect(await start("Second")).toBe(false);
    });
    expect(respond.mock.calls.filter(([request]) => request.kind === "insert")).toHaveLength(1);
});

it("ignores a read started during Stop when it resolves after the update", async () => {
    active = runningRow();
    const oldRow = active;
    const update = deferred<Response>();
    const duringStop = deferred<Response>();
    let duringStopRequests = 0;
    let saving = false;
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "update") {
            saving = true;
            return update.promise;
        }
        if (request.kind === "week" && saving) {
            duringStopRequests++;
            return duringStop.promise;
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    let stop!: Promise<boolean>;
    await act(async () => { stop = result.current.handleStop(); });
    act(() => result.current.goToPreviousWeek());
    await waitFor(() => expect(duringStopRequests).toBe(1));
    saving = false;
    active = null;
    weekRows = [{ ...oldRow, ended_at: new Date().toISOString() }];
    await act(async () => {
        update.resolve({ data: weekRows[0], error: null });
        expect(await stop).toBe(true);
        duringStop.resolve({ data: [oldRow], error: null });
    });
    await waitFor(() => expect(result.current.entries[0]?.endedAt).not.toBeNull());
    expect(result.current.runningEntryId).toBeNull();
    expect(result.current.entries[0].endedAt).toBe(weekRows[0].ended_at);
});

it("requires a new active lookup after an uncertain insert outcome", async () => {
    const refreshed = deferred<Response>();
    let lookups = 0;
    respond.mockImplementation((request) => {
        if (request.kind === "insert") {
            active = runningRow();
            throw new Error("Response lost after insert");
        }
        if (request.kind === "active") return ++lookups === 1 ? { data: [], error: null } : refreshed.promise;
        return { data: [], error: null };
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    const start = result.current.handleStart;
    await act(async () => { expect(await start("Task")).toBe(false); });
    expect(result.current.isTimerReady).toBe(false);
    await act(async () => { expect(await start("Duplicate")).toBe(false); });
    expect(respond.mock.calls.filter(([request]) => request.kind === "insert")).toHaveLength(1);
    await act(async () => { refreshed.resolve({ data: [active!], error: null }); });
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
});

it("resets pending state after thrown errors and recovers from a failed active lookup", async () => {
    let lookupFailed = true;
    respond.mockImplementation((request) => {
        if (request.kind === "active" && lookupFailed) throw new Error("Offline");
        if (request.kind === "insert") throw new Error("Network unavailable");
        return { data: [], error: null };
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.errorMessage).toContain("Offline"));
    expect(result.current.isTimerReady).toBe(false);
    lookupFailed = false;
    act(() => result.current.refreshEntries());
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    await act(async () => { expect(await result.current.handleStart("Task")).toBe(false); });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.errorMessage).toContain("Network unavailable");
});

it("refreshes active state after a uniqueness conflict from another tab", async () => {
    const read = respond.getMockImplementation()!;
    respond.mockImplementation((request) => {
        if (request.kind === "insert") {
            active = runningRow();
            return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        return read(request);
    });
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    await act(async () => { expect(await result.current.handleStart("Task")).toBe(false); });
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    expect(result.current.errorMessage).toContain("already running");
});

it("clears private state on logout and ignores late responses", async () => {
    active = runningRow();
    const pending = deferred<Response>();
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.runningEntryId).toBe("timer-1"));
    respond.mockImplementation(() => pending.promise);
    act(() => result.current.refreshEntries());
    act(() => authChanged("SIGNED_OUT", null));
    await act(async () => { pending.resolve({ data: [active!], error: null }); });
    expect(result.current.entries).toEqual([]);
    expect(result.current.runningEntryId).toBeNull();
    expect(result.current.isSignedOut).toBe(true);
});

it("recovers from a failed session lookup through retry", async () => {
    client.auth.getUser.mockRejectedValueOnce(new Error("Session offline"));
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.errorMessage).toContain("Session offline"));
    act(() => result.current.refreshEntries());
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    expect(result.current.errorMessage).toBeNull();
});

it("ignores an obsolete bootstrap request under Strict Mode", async () => {
    const obsolete = deferred<{ data: { user: null }; error: null }>();
    client.auth.getUser.mockReturnValueOnce(obsolete.promise);
    const { result } = renderHook(useTimerEntries, { wrapper: StrictMode });
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    await act(async () => { obsolete.resolve({ data: { user: null }, error: null }); });
    expect(result.current.isTimerReady).toBe(true);
    expect(result.current.isSignedOut).toBe(false);
});

it("updates the week and today marker after midnight on focus", async () => {
    vi.spyOn(Date, "now").mockReturnValue(new Date(2026, 9, 11, 23, 59).getTime());
    const { result } = renderHook(useTimerEntries);
    await waitFor(() => expect(result.current.isTimerReady).toBe(true));
    expect(result.current.week[6].isToday).toBe(true);
    vi.spyOn(Date, "now").mockReturnValue(new Date(2026, 9, 12, 0, 1).getTime());
    act(() => window.dispatchEvent(new Event("focus")));
    expect(result.current.week[0].isoDate).toBe("2026-10-12");
    expect(result.current.week[0].isToday).toBe(true);
});
