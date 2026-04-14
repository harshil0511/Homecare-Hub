"use client";

import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function BackendStatus() {
    const [offline, setOffline] = useState(false);
    const [checking, setChecking] = useState(false);

    const checkHealth = async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(`${API}/api/v1/health`, {
                method: "GET",
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) {
                setOffline(false);
            } else {
                setOffline(true);
            }
        } catch (err) {
            clearTimeout(timeout);
            console.warn("[BackendStatus] Health check failed:", err);
            setOffline(true);
        }
    };

    useEffect(() => {
        setTimeout(() => checkHealth(), 0);
        const interval = setInterval(checkHealth, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleRetry = async () => {
        setChecking(true);
        await checkHealth();
        setTimeout(() => setChecking(false), 600);
    };

    if (!offline) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] animate-fade-in">
            <div className="flex items-center gap-3 bg-rose-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl shadow-rose-900/30 border border-rose-500">
                <WifiOff className="w-4 h-4 flex-shrink-0" />
                <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest">Backend Offline</p>
                    <p className="text-[10px] font-medium text-rose-100 mt-0.5">Please start the backend server</p>
                </div>
                <button
                    onClick={handleRetry}
                    className="ml-2 p-2 rounded-xl bg-rose-500 hover:bg-rose-400 transition-colors flex-shrink-0"
                    title="Retry connection"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
                </button>
            </div>
        </div>
    );
}
