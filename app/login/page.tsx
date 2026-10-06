import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/timer");
  const params = await searchParams;
  return <LoginForm initialError={params.error === "confirmation" ? "The confirmation link is invalid or expired. Please sign in or request a new confirmation email." : null} />;
}
