"use client";

import { XCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface AlertBarProps {
    message: string;
    type?: "success" | "error" | "warning" | "info";
    duration?: number;
}

export default function AlertBar({
    message,
    type = "info",
    duration = 4000,
}: AlertBarProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (!message) return;

        const timer = setTimeout(() => {
            setVisible(false);
        }, duration);

        return () => clearTimeout(timer);
    }, [message, duration]);

    if (!message || !visible) return null;

    const typeStyles = {
        success: "bg-green-100 text-green-800 border-green-400",
        error: "bg-red-100 text-red-800 border-red-400",
        warning: "bg-yellow-100 text-yellow-800 border-yellow-400",
        info: "bg-blue-100 text-blue-800 border-blue-400",
    };

    return (
        <div
            className={`w-full border-l-4 p-4 rounded-md shadow-sm mb-4 flex justify-between items-center transition-all duration-300 ${typeStyles[type]}`}
        >
            <span className="font-medium">{message}</span>

            <button
                onClick={() => setVisible(false)}
                className="ml-4 hover:opacity-70 transition"
            >
                <XCircle size={18} />
            </button>
        </div>
    );
}
