import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/src/lib/supabase/config";

export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    const { url: supabaseUrl, key } = getSupabaseConfig();
    const supabase = createServerClient(
        supabaseUrl,
        key,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isLoginPage = request.nextUrl.pathname.startsWith("/login");
    const isTimerPage = request.nextUrl.pathname.startsWith("/timer");
    const redirectWithCookies = (url: URL) => {
        const redirect = NextResponse.redirect(url);
        response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
        return redirect;
    };
    if (!user && isTimerPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return redirectWithCookies(url);
    }
    if (user && isLoginPage) {
        const url = request.nextUrl.clone();
        url.pathname = "/timer";
        return redirectWithCookies(url);
    }
    return response;
}
export const config = {
    matcher: ["/login", "/timer/:path*"],
};
