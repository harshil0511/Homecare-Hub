"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminSettingsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/admin/settings/profile");
    }, [router]);
    return null;
}
