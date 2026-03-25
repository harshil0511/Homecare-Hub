"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn, getRole, logout } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        // Run auth check on every route change
        const checkAuth = () => {
            const loggedIn = isLoggedIn();
            
            if (!loggedIn) {
                // Not logged in -> Redirect to login
                setAuthorized(false);
                router.push("/login");
                return;
            }

            const role = getRole();
            
            // Basic role-based access logic
            // 1. Admin paths restricted to ADMIN role
            if (pathname.startsWith("/admin") && role !== "ADMIN") {
                router.push("/dashboard");
                return;
            }

            // 2. Servicer paths restricted to SERVICER role
            // Note: Currently servicer paths are mixed in dashboard/servicer
            if (pathname.includes("/servicer") && role !== "SERVICER" && role !== "ADMIN") {
                router.push("/dashboard");
                return;
            }

            setAuthorized(true);
        };

        checkAuth();
    }, [pathname, router]);

    if (!authorized) {
        // Show a loading state or nothing while redirecting
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
}
