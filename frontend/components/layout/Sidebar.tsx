"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, CalendarCheck, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Zap, Search, Home
} from "lucide-react";
import { logout, getRole, getUsername } from "@/lib/auth";

const SETTINGS_CHILDREN = [
  { name: "Profile", icon: User, path: "/dashboard/settings/profile" },
  { name: "Password", icon: Lock, path: "/dashboard/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/dashboard/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/dashboard/settings/account" },
];

const USER_NAV = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { name: "Operations", icon: ClipboardList, path: "/dashboard/bookings/history" },
    { name: "Find Experts", icon: Search, path: "/dashboard/providers" },
    { name: "Home Service", icon: Home, path: "/dashboard/routine" },
    { name: "Home Health", icon: Wrench, path: "/dashboard/maintenance" },
    { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

const SERVICER_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/dashboard/servicer" },
  { name: "My Jobs", icon: Briefcase, path: "/dashboard/servicer/jobs" },
  { name: "Ratings", icon: Star, path: "/dashboard/servicer/ratings" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

const ADMIN_NAV = [
  { name: "Overview", icon: BarChart3, path: "/admin" },
  { name: "All Users", icon: Users, path: "/admin/users" },
  { name: "Providers", icon: UserCheck, path: "/admin/providers" },
  { name: "Bookings", icon: ClipboardList, path: "/admin/bookings" },
  { name: "System Logs", icon: ShieldCheck, path: "/admin/logs" },
  { name: "Settings", icon: Settings, path: "/dashboard/settings" },
];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "text-purple-700 bg-purple-50" },
  SERVICER: { label: "Servicer", color: "text-emerald-700 bg-emerald-50" },
  USER: { label: "Home User", color: "text-blue-700 bg-blue-50" },
};

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setRole(getRole());
    setUsername(getUsername());
  }, []);

  // Auto-open settings sub-menu when on a settings page
  useEffect(() => {
    if (pathname.startsWith("/dashboard/settings")) {
      setSettingsOpen(true);
    }
  }, [pathname]);

  const menuItems =
    role === "ADMIN" ? ADMIN_NAV :
      role === "SERVICER" ? SERVICER_NAV :
        USER_NAV;

  const badge = role ? ROLE_BADGE[role] : null;

  return (
    <div className="w-64 min-h-screen bg-white border-r border-slate-200 flex flex-col flex-shrink-0 animate-fade-in relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Brand Logo - ShigenTech Style */}
      <div className="flex items-center gap-3 px-6 py-8">
        <div className="w-10 h-10 bg-[#064e3b] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-900/10 transition-transform hover:scale-105 cursor-pointer">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-[#000000] text-lg leading-tight tracking-tight truncate">Homecare Hub</p>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5">Control Center</p>
        </div>
      </div>

      {/* Profile Summary Card */}
      <div className="px-5 mb-8">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
          <div className="w-10 h-10 rounded-xl bg-[#064e3b] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#000000] truncate leading-tight uppercase tracking-tight">{username || "User"}</p>
            {badge && (
              <p className={`text-[9px] font-black mt-1 px-1.5 py-0.5 rounded-md w-fit uppercase tracking-tighter ${badge.color}`}>
                {badge.label}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-7 mb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Module Index</p>
      </div>

      {/* Navigation - INTERACTIVE ONLY Green Surrounding */}
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isSettings = item.name === "Settings";
          const isOnSettingsPage = pathname.startsWith("/dashboard/settings");
          const isActive = isSettings
            ? isOnSettingsPage
            : pathname === item.path || pathname.startsWith(item.path + "/");

          return (
            <div key={item.name}>
              {isSettings ? (
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`w-full group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-black transition-all duration-150 relative outline-none ${isActive
                    ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/20"
                    : "text-slate-500 hover:bg-[#064e3b] hover:text-white hover:shadow-xl hover:shadow-emerald-900/20"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400"} group-hover:text-white`} />
                    <span className="tracking-tight">{item.name}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-all duration-200 ${settingsOpen ? "rotate-90" : ""} ${isActive ? "text-white opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100"} group-hover:text-white`} />
                </button>
              ) : (
                <Link
                  href={item.path}
                  className={`group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-black transition-all duration-150 relative outline-none ${isActive
                    ? "bg-[#064e3b] text-white shadow-lg shadow-emerald-900/20"
                    : "text-slate-500 hover:bg-[#064e3b] hover:text-white hover:shadow-xl hover:shadow-emerald-900/20"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400"} group-hover:text-white`} />
                    <span className="tracking-tight">{item.name}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-all ${isActive ? "text-white opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1"} group-hover:text-white`} />
                </Link>
              )}

              {/* Settings Sub-menu (toggle) */}
              {isSettings && settingsOpen && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                  {SETTINGS_CHILDREN.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = pathname === sub.path;
                    return (
                      <Link
                        key={sub.path}
                        href={sub.path}
                        className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-black transition-all ${
                          isSubActive
                            ? "bg-emerald-50 text-[#064e3b]"
                            : "text-slate-400 hover:text-[#064e3b] hover:bg-slate-50"
                        }`}
                      >
                        <SubIcon className={`w-3.5 h-3.5 ${isSubActive ? "text-[#064e3b]" : "text-slate-300 group-hover:text-[#064e3b]"}`} />
                        <span className="tracking-tight">{sub.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Profile/Logout Area */}
      <div className="px-4 py-6 border-t border-slate-100 mt-auto">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-black text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all outline-none"
        >
          <LogOut className="w-4 h-4" />
          <span className="tracking-[0.1em] uppercase">Terminate Session</span>
        </button>
      </div>
    </div>
  );
}
