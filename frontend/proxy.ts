import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Each route prefix has its own token cookie
const ROUTE_COOKIES: Array<{ prefix: string; cookie: string }> = [
    { prefix: "/admin",     cookie: "hc_token_ADMIN" },
    { prefix: "/user",      cookie: "hc_token_USER" },
    { prefix: "/service",   cookie: "hc_token_SERVICER" },
    { prefix: "/secretary", cookie: "hc_token_SECRETARY" },
];

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

    // /login and /register are always accessible — never redirect away
    if (pathname === "/login" || pathname === "/register") {
        return NextResponse.next();
    }

    // Find which role this route belongs to
    const routeMatch = ROUTE_COOKIES.find(r => pathname.startsWith(r.prefix));
    if (routeMatch) {
        const token = request.cookies.get(routeMatch.cookie)?.value;
        if (!token) {
            return NextResponse.redirect(new URL("/login", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
