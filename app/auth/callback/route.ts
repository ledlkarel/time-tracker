import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
        try {
            const supabase = await createServerSupabaseClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) return NextResponse.redirect(new URL("/timer", request.url));
        } catch {
            // Failed exchanges return to login with a recoverable error.
        }
    }
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
}
