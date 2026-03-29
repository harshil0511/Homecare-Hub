"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn, getRole } from "@/lib/auth";

const ROLE_HOME: Record<string, string> = {
    ADMIN: "/admin/dashboard",
    SECRETARY: "/secretary/dashboard",
    USER: "/user/dashboard",
    SERVICER: "/service/dashboard",
};

const ROUTE_ROLE: Array<{ prefix: string; role: string }> = [
    { prefix: "/admin", role: "ADMIN" },
    { prefix: "/secretary", role: "SECRETARY" },
    { prefix: "/user", role: "USER" },
    { prefix: "/service", role: "SERVICER" },
];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const checkAuth = () => {
            if (!isLoggedIn()) {
                setAuthorized(false);
                router.push("/login");
                return;
            }

            const role = getRole();
            if (!role) {
                router.push("/login");
                return;
            }

            // Legacy /dashboard paths → redirect to role-specific home
            if (pathname.startsWith("/dashboard")) {
                router.push(ROLE_HOME[role] ?? "/login");
                return;
            }

            // Find which route tree we're in
            const routeEntry = ROUTE_ROLE.find((r) => pathname.startsWith(r.prefix));
            if (routeEntry && routeEntry.role !== role) {
                // Wrong role for this route tree → send to their correct home
                router.push(ROLE_HOME[role] ?? "/login");
                return;
            }

            setAuthorized(true);
        };

        checkAuth();
    }, [pathname, router]);

    if (!authorized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
