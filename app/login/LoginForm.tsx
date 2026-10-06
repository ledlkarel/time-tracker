"use client";
import { createClient } from "@/src/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

export function LoginForm({ initialError = null }: { initialError?: string | null }) {
    const supabase = useMemo(() => createClient(), []);
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(initialError);
    const pending = useRef(false);

    const authenticate = async (signUp: boolean) => {
        if (pending.current) return;
        pending.current = true;
        setIsLoading(true);
        setErrorMessage(null);
        setMessage(null);
        try {
            const credentials = { email: email.trim(), password };
            const { data, error } = signUp
                ? await supabase.auth.signUp({ ...credentials, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
                : await supabase.auth.signInWithPassword(credentials);
            if (error) throw new Error(error.message);
            if (data.session) {
                router.replace("/timer");
                router.refresh();
            } else if (signUp) {
                setMessage("Check your email for the account confirmation link.");
            } else {
                throw new Error("No session was created. Please try signing in again.");
            }
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Authentication failed. Please try again.");
        } finally {
            pending.current = false;
            setIsLoading(false);
        }
    };

    return (
        <main className="mx-auto mt-16 w-full max-w-md rounded border border-neutral-200 p-6 dark:border-neutral-700">
            <h1 className="text-2xl font-semibold">Login</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Sign in to track your own time entries.</p>
            <form className="mt-6 space-y-3" onSubmit={(event) => {
                event.preventDefault();
                const submitter = (event.nativeEvent as SubmitEvent).submitter;
                void authenticate(submitter instanceof HTMLButtonElement && submitter.value === "sign-up");
            }}>
                <div>
                    <label htmlFor="email" className="mb-1 block text-sm">Email</label>
                    <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isLoading} />
                </div>
                <div>
                    <label htmlFor="password" className="mb-1 block text-sm">Password</label>
                    <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isLoading} />
                </div>
                <div className="flex gap-2">
                    <button type="submit" value="sign-in" disabled={isLoading} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{isLoading ? "Please wait..." : "Sign in"}</button>
                    <button type="submit" value="sign-up" disabled={isLoading} className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700">Sign up</button>
                </div>
            </form>
            {errorMessage ? <p role="alert" className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{errorMessage}</p> : null}
            {message ? <p role="status" className="mt-4 rounded bg-emerald-50 p-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">{message}</p> : null}
        </main>
    );
}
