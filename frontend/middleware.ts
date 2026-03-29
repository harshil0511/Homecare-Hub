import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't need auth
const PUBLIC_PATHS = ["/login", "/register", "/"];

// Protected route prefixes
const PROTECTED_PREFIXES = ["/admin", "/secretary", "/user", "/service"];

// Role → home path mapping
const ROLE_HOME: Record<string, string> = {
    ADMIN: "/admin/dashboard",
    SECRETARY: "/secretary/dashboard",
    USER: "/user/dashboard",
    SERVICER: "/service/dashboard",
};

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

    // Has token on /login or /register → redirect to /user/dashboard
    // (actual role-based redirect handled by login page after reading localStorage)
    if (token && (pathname === "/login" || pathname === "/register")) {
        return NextResponse.redirect(new URL("/user/dashboard", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
