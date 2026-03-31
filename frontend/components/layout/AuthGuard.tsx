"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isRoleLoggedIn, getRoleFromPath } from "@/lib/auth";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const role = getRoleFromPath(pathname);
        if (role && !isRoleLoggedIn(role)) {
            setAuthorized(false);
            router.push("/login");
            return;
        }
        setAuthorized(true);
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
