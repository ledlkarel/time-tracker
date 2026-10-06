import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import { TimerView } from "./TimerView";

export default async function TimerPage() {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    return <TimerView />;
}
