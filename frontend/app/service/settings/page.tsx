"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ServicerSettingsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/service/settings/profile");
    }, [router]);
    return null;
}
