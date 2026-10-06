import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/login/LoginForm";

const mocks = vi.hoisted(() => ({
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn() },
    router: { replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock("@/src/lib/supabase/client", () => ({ createClient: () => ({ auth: mocks.auth }) }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

beforeEach(() => {
    mocks.auth.signInWithPassword.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
});
afterEach(cleanup);

function fillCredentials() {
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "example-password" } });
}

it("supports default form submission for sign-in", async () => {
    render(<LoginForm />);
    fillCredentials();
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/timer"));
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({ email: "person@example.com", password: "example-password" });
});

it("shows confirmation instructions when signup does not create a session", async () => {
    render(<LoginForm />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Check your email"));
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: `${window.location.origin}/auth/callback` } }));
});

it("redirects immediately when signup returns a session", async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
    render(<LoginForm />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/timer"));
});

it("resets pending state after a thrown authentication error", async () => {
    mocks.auth.signInWithPassword.mockRejectedValueOnce(new Error("Offline"));
    render(<LoginForm />);
    fillCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Offline"));
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/timer"));
});
