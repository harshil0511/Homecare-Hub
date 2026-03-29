import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Protected route prefixes
const PROTECTED_PREFIXES = ["/admin", "/secretary", "/user", "/service"];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip static assets and API routes
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/uploads") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    const token = request.cookies.get("hc_token")?.value;
    const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

    // No token on protected route → redirect to login
    if (isProtected && !token) {
        const loginUrl = new URL("/login", request.url);
        return NextResponse.redirect(loginUrl);
    }

    // Has token on /login or /register → redirect to default dashboard
    // (client-side login page handles role-specific redirect after reading localStorage)
    if (token && (pathname === "/login" || pathname === "/register")) {
        return NextResponse.redirect(new URL("/user/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
