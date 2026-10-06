// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/src/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "test-key" }) }));
vi.mock("@supabase/ssr", () => ({
    createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: unknown[]) => void } }) => ({
        auth: {
            getUser: async () => {
                options.cookies.setAll([{ name: "refreshed-session", value: "new-token", options: { httpOnly: true, path: "/", sameSite: "lax" } }]);
                return mocks.getUser();
            },
        },
    }),
}));
afterEach(() => mocks.getUser.mockReset());

it.each([
    ["/timer", null, "/login"],
    ["/login", { id: "user-1" }, "/timer"],
])("preserves refreshed cookies when redirecting %s", async (path, user, destination) => {
    mocks.getUser.mockResolvedValue({ data: { user } });
    const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(response.headers.get("location")).toBe(`http://localhost:3000${destination}`);
    expect(response.cookies.get("refreshed-session")).toMatchObject({ value: "new-token", httpOnly: true, path: "/", sameSite: "lax" });
});
