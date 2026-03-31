"use client";

import { useEffect, useState, useRef } from "react";
import {
    Bell,
    Search,
    ChevronDown,
    User,
    Settings,
    LogOut,
    Shield,
    Menu,
    Wrench,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { logout, getRole } from "@/lib/auth";
import Link from "next/link";

const ROLE_ALERTS: Record<string, string> = {
    ADMIN: "/admin/dashboard",
    USER: "/user/alerts",
    SERVICER: "/service/dashboard",
    SECRETARY: "/secretary/alerts",
};

const ROLE_SETTINGS: Record<string, string> = {
    ADMIN: "/admin/settings",
    USER: "/user/settings",
    SERVICER: "/service/settings",
    SECRETARY: "/secretary/settings",
};

const ROLE_PROFILE: Record<string, string> = {
    ADMIN: "/admin/settings/profile",
    USER: "/user/settings/profile",
    SERVICER: "/service/settings/profile",
    SECRETARY: "/secretary/settings/profile",
};

interface UserProfile {
    username: string;
    email: string;
    role: string;
}

interface Notification {
    id: number;
    title: string;
    message: string;
    notification_type: string;
    is_read: boolean;
    created_at: string;
}

interface NavbarProps { onMenuToggle: () => void; isSidebarOpen: boolean; }

export default function Navbar({ onMenuToggle, isSidebarOpen }: NavbarProps) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [role, setRole] = useState<string>("USER");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    const fetchNotifications = async () => {
        try {
            const data = await apiFetch("/notifications/");
            setNotifications(data);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    useEffect(() => {
        const storedRole = getRole() || "USER";
        setRole(storedRole);

        const fetchUser = async () => {
            try {
                const data = await apiFetch("/user/me");
                setUser(data);
                setRole(data.role || storedRole);
            } catch (err) {
                setUser({
                    username: localStorage.getItem("hc_username") || "User",
                    email: "",
                    role: storedRole,
                });
            }
        };
        fetchUser();
        fetchNotifications();

        // Optional polling for real-time feel
        const interval = setInterval(fetchNotifications, 60000); // 1 minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: number) => {
        try {
            await apiFetch(`/notifications/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_read: true })
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const roleBadge: Record<string, string> = {
        ADMIN: "bg-purple-500/10 text-purple-300 border border-purple-500/20",
        SERVICER: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
        USER: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-[#064e3b] px-4 flex items-center justify-between z-[1000] shadow-lg shadow-black/10">
            {/* Left: Toggle + Logo */}
            <div className="flex items-center gap-3 flex-shrink-0">
                <button
                    onClick={onMenuToggle}
                    className="w-9 h-9 flex items-center justify-center text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    aria-label="Toggle sidebar"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Wrench className="w-4 h-4 text-white" />
                    </div>
                    <div className="hidden sm:block">
                        <p className="font-black text-white text-sm leading-tight tracking-tight">Homecare Hub</p>
                        <p className="text-[9px] text-emerald-300 font-black uppercase tracking-[0.2em]">Control Center</p>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md mx-4">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                    <input
                        className="w-full bg-white border border-emerald-100 rounded-lg py-2 pl-12 pr-4 text-sm text-[#000000] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-semibold shadow-sm"
                        placeholder="Search by name, service or task..."
                    />
                </div>
            </div>

            {/* Right side - Contrast White Content on Green */}
            <div className="flex items-center gap-5">
                {/* Notification */}
                <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className="relative w-9 h-9 flex items-center justify-center text-emerald-100 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full border-2 border-[#064e3b] flex items-center justify-center">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotifOpen && (
                        <div className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] p-2 animate-fade-in z-[100]">
                            <div className="px-4 py-3 border-b border-slate-100 mb-1 flex justify-between items-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notifications</p>
                                <span className="text-[9px] font-black text-emerald-600 uppercase">Real-time</span>
                            </div>

                            <div className="max-h-[350px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Shield className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No Alerts Found</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div 
                                            key={notif.id}
                                            onClick={() => markAsRead(notif.id)}
                                            className={`p-4 rounded-lg mb-1 cursor-pointer transition-all ${notif.is_read ? 'opacity-60 grayscale-[0.5]' : 'bg-slate-50 hover:bg-slate-100'}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                                    notif.notification_type === 'URGENT' ? 'bg-rose-500' :
                                                    notif.notification_type === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`} />
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-black text-[#000000] uppercase tracking-tight">{notif.title}</p>
                                                    <p className="text-[10px] font-bold text-slate-600 leading-normal">{notif.message}</p>
                                                    <p className="text-[8px] font-black text-slate-400 uppercase mt-1">
                                                        {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            
                            <Link
                                href={ROLE_ALERTS[role] ?? "/user/alerts"}
                                onClick={() => setIsNotifOpen(false)}
                                className="block text-center py-2.5 mt-1 text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:bg-emerald-50 rounded-lg transition-all"
                            >
                                View All Control Alerts ↗
                            </Link>
                        </div>
                    )}
                </div>

                <div className="w-px h-5 bg-emerald-800/60 hidden sm:block" />

                {/* User Session Profile */}
                <div className="relative" ref={dropdownRef}>
                    <div
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 cursor-pointer select-none group"
                    >
                        <div className="flex flex-col items-end hidden sm:flex">
                            <p className="text-sm font-bold text-white leading-tight">
                                {user?.username || "User"}
                            </p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter mt-1 ${roleBadge[user?.role || "USER"]}`}>
                                {user?.role || "USER"}
                            </span>
                        </div>
                        <div className="w-9 h-9 bg-white text-[#064e3b] rounded-lg flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-emerald-50 transition-colors">
                            {user?.username?.[0]?.toUpperCase() || "U"}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-emerald-300 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
                    </div>

                    {isDropdownOpen && (
                        <div className="absolute top-full right-0 mt-3 w-60 bg-white border border-slate-200 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] p-2 animate-fade-in z-[100]">
                            <div className="px-4 py-3 border-b border-slate-100 mb-1">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Account</p>
                                <p className="text-sm text-[#000000] font-black truncate">{user?.email || user?.username}</p>
                            </div>

                            <Link
                                href={ROLE_PROFILE[role] ?? "/user/settings/profile"}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#000000] hover:bg-slate-50 hover:text-emerald-700 transition-all font-black"
                                onClick={() => setIsDropdownOpen(false)}
                            >
                                <User className="w-4 h-4" />
                                My Profile
                            </Link>

                            <Link
                                href={ROLE_SETTINGS[role] ?? "/user/settings"}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-[#000000] hover:bg-slate-50 hover:text-emerald-700 transition-all font-black"
                                onClick={() => setIsDropdownOpen(false)}
                            >
                                <Settings className="w-4 h-4 text-slate-400" />
                                Settings
                            </Link>

                            <div className="h-px bg-slate-100 my-1.5 mx-2" />

                            <button
                                onClick={() => logout()}
                                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 transition-all font-semibold"
                            >
                                <LogOut className="w-4 h-4" />
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
