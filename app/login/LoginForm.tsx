"use client";
import { createClient } from "@/src/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function LoginForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.push("/timer");
    router.refresh();
  };

  const handleSignUp = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setIsLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setMessage("Account created. Check your email if confirmation is enabled.");
  };
  
  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded border border-neutral-200 p-6">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Sign in to track your own time entries.
      </p>
      <div className="mt-6 space-y-3">
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={isLoading}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={handleSignUp}
          disabled={isLoading}
          className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          Sign up
        </button>
      </div>
      {errorMessage ? (
        <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded bg-emerald-50 p-2 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}