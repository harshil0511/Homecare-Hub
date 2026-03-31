"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SecretarySettingsPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/secretary/settings/profile");
    }, [router]);
    return null;
}
