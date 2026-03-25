"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BookingsRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/dashboard/bookings/history");
    }, [router]);
    return null;
}
