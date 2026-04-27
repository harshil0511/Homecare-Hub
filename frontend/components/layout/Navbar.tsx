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
    X,
    CheckCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { logout, getRole } from "@/lib/auth";
import Link from "next/link";
import { useToast } from "@/lib/toast-context";

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
    const [expandedNotifId, setExpandedNotifId] = useState<number | null>(null);
    const seenIdsRef = useRef<Set<number>>(new Set());
    const isFirstFetchRef = useRef(true);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);

    let toast: ReturnType<typeof useToast> | null = null;
    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        toast = useToast();
    } catch {
        // Navbar may render outside ToastProvider on non-portal pages (e.g. login)
    }

    const fetchNotifications = async () => {
        try {
            const data: Notification[] = await apiFetch("/notifications/");
            setNotifications(data);

            if (isFirstFetchRef.current) {
                // Seed seen IDs on first load — don't pop toasts for existing notifications
                data.forEach(n => seenIdsRef.current.add(n.id));
                isFirstFetchRef.current = false;
                return;
            }

            // Fire toast popup for any notification we haven't seen yet
            if (toast) {
                data.forEach(n => {
                    if (!seenIdsRef.current.has(n.id)) {
                        seenIdsRef.current.add(n.id);
                        toast!.notify(n.title, n.message, n.notification_type as "INFO" | "WARNING" | "URGENT");
                    }
                });
            }
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    useEffect(() => {
        const storedRole = getRole() || "USER";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRole(storedRole);

        const fetchUser = async () => {
            try {
                const data = await apiFetch("/user/me");
                setUser(data);
                setRole(data.role || storedRole);
            } catch (err) {
                setUser({
                    username: sessionStorage.getItem("hc_username") || "User",
                    email: "",
                    role: storedRole,
                });
            }
        };
        fetchUser();
        fetchNotifications();

        // Poll every 30s for new notifications
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const markAllRead = async () => {
        const unread = notifications.filter(n => !n.is_read);
        await Promise.all(unread.map(n =>
            apiFetch(`/notifications/${n.id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_read: true })
            }).catch(() => null)
        ));
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    };

    const handleNotifClick = (id: number) => {
        setExpandedNotifId(prev => prev === id ? null : id);
        const notif = notifications.find(n => n.id === id);
        if (notif && !notif.is_read) markAsRead(id);
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const roleBadge: Record<string, string> = {
        ADMIN: "bg-purple-500/10 text-purple-300 border border-purple-500/20",
        SERVICER: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
        USER: "bg-blue-500/10 text-blue-300 border border-blue-500/20",
    };

    return (
        <header className={`fixed top-0 right-0 h-16 bg-[#064e3b] px-4 flex items-center justify-between z-[999] shadow-lg shadow-black/10 transition-all duration-300 ${isSidebarOpen ? "left-64" : "left-0 md:left-16"}`}>
            {/* Mobile-only menu toggle (hidden on desktop since sidebar has its own toggle) */}
            <button
                onClick={onMenuToggle}
                className="w-9 h-9 flex items-center justify-center text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-all md:hidden"
                aria-label="Toggle sidebar"
            >
                <Menu className="w-5 h-5" />
            </button>

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
                            {/* Header */}
                            <div className="px-4 py-3 border-b border-slate-100 mb-1 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notifications</p>
                                    {unreadCount > 0 && (
                                        <span className="px-1.5 py-0.5 bg-rose-50 text-rose-500 border border-rose-100 rounded text-[8px] font-black">{unreadCount} new</span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="flex items-center gap-1 text-[9px] font-black text-emerald-700 uppercase tracking-widest hover:text-emerald-900 transition-colors"
                                    >
                                        <CheckCheck className="w-3 h-3" />
                                        Mark all read
                                    </button>
                                )}
                            </div>

                            <div className="max-h-[350px] overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Shield className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">All caught up</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            className={`rounded-lg mb-1 transition-all ${notif.is_read ? 'opacity-50' : 'bg-slate-50'}`}
                                        >
                                            {/* Row */}
                                            <div
                                                onClick={() => handleNotifClick(notif.id)}
                                                className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-100 rounded-lg transition-all"
                                            >
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                                    notif.notification_type === 'URGENT' ? 'bg-rose-500' :
                                                    notif.notification_type === 'WARNING' ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`} />
                                                <div className="flex-1 min-w-0 space-y-0.5">
                                                    <p className="text-xs font-black text-[#000000] uppercase tracking-tight leading-tight">{notif.title}</p>
                                                    <p className="text-[8px] font-black text-slate-400 uppercase">
                                                        {new Date(notif.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={e => { e.stopPropagation(); markAsRead(notif.id); }}
                                                    className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-200 rounded transition-all flex-shrink-0"
                                                    title="Dismiss"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>

                                            {/* Expanded message */}
                                            {expandedNotifId === notif.id && (
                                                <div className="px-4 pb-3 pt-0">
                                                    <p className="text-[10px] font-medium text-slate-600 leading-relaxed border-l-2 border-emerald-300 pl-3">
                                                        {notif.message}
                                                    </p>
                                                </div>
                                            )}
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
