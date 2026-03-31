"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Wrench, Bell, Settings,
  LogOut, Briefcase, Star, Users, ShieldCheck,
  BarChart3, ClipboardList, UserCheck, ChevronRight,
  User, Lock, BellRing, Search, Home,
} from "lucide-react";
import { logout, getRole, getUsername } from "@/lib/auth";

const USER_SETTINGS = [
  { name: "Profile", icon: User, path: "/user/settings/profile" },
  { name: "Password", icon: Lock, path: "/user/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/user/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/user/settings/account" },
];

const ADMIN_SETTINGS = [
  { name: "Profile", icon: User, path: "/admin/settings/profile" },
  { name: "Password", icon: Lock, path: "/admin/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/admin/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/admin/settings/account" },
];

const SERVICE_SETTINGS = [
  { name: "Profile", icon: User, path: "/service/settings/profile" },
  { name: "Password", icon: Lock, path: "/service/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/service/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/service/settings/account" },
];

const SECRETARY_SETTINGS = [
  { name: "Profile", icon: User, path: "/secretary/settings/profile" },
  { name: "Password", icon: Lock, path: "/secretary/settings/password" },
  { name: "Notifications", icon: BellRing, path: "/secretary/settings/notifications" },
  { name: "Account", icon: ShieldCheck, path: "/secretary/settings/account" },
];

const USER_NAV = [
    { name: "Dashboard", icon: LayoutDashboard, path: "/user/dashboard" },
    { name: "My Requests", icon: ClipboardList, path: "/user/bookings" },
    { name: "Find Experts", icon: Search, path: "/user/providers" },
    { name: "Home Service", icon: Home, path: "/user/routine" },
    { name: "Alerts", icon: Bell, path: "/user/alerts" },
    { name: "Settings", icon: Settings, path: "/user/settings" },
];

const SERVICER_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/service/dashboard" },
  { name: "My Jobs", icon: Briefcase, path: "/service/jobs" },
  { name: "Ratings", icon: Star, path: "/service/ratings" },
  { name: "Settings", icon: Settings, path: "/service/settings" },
];

const ADMIN_NAV = [
  { name: "Overview", icon: BarChart3, path: "/admin/dashboard" },
  { name: "All Users", icon: Users, path: "/admin/users" },
  { name: "Providers", icon: UserCheck, path: "/admin/providers" },
  { name: "Bookings", icon: ClipboardList, path: "/admin/bookings" },
  { name: "System Logs", icon: ShieldCheck, path: "/admin/logs" },
  { name: "Settings", icon: Settings, path: "/admin/settings" },
];

const SECRETARY_NAV = [
  { name: "Overview", icon: LayoutDashboard, path: "/secretary/dashboard" },
  { name: "Members", icon: Users, path: "/secretary/members" },
  { name: "Alerts", icon: Bell, path: "/secretary/alerts" },
  { name: "Providers", icon: Wrench, path: "/secretary/providers" },
  { name: "Settings", icon: Settings, path: "/secretary/settings" },
];

const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "text-purple-700 bg-purple-50" },
  SERVICER: { label: "Servicer", color: "text-emerald-700 bg-emerald-50" },
  USER: { label: "Home User", color: "text-blue-700 bg-blue-50" },
  SECRETARY: { label: "Secretary", color: "text-amber-700 bg-amber-50" },
};

const SETTINGS_PATH_PREFIX: Record<string, string> = {
  ADMIN: "/admin/settings",
  USER: "/user/settings",
  SERVICER: "/service/settings",
  SECRETARY: "/secretary/settings",
};

interface SidebarProps { isOpen: boolean; onToggle: () => void; }

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setRole(getRole());
    setUsername(getUsername());
  }, []);

  useEffect(() => {
    if (role && pathname.startsWith(SETTINGS_PATH_PREFIX[role] ?? "/settings")) {
      setSettingsOpen(true);
    }
  }, [pathname, role]);

  const menuItems =
    role === "ADMIN" ? ADMIN_NAV :
    role === "SERVICER" ? SERVICER_NAV :
    role === "SECRETARY" ? SECRETARY_NAV :
    USER_NAV;

  const settingsChildren =
    role === "ADMIN" ? ADMIN_SETTINGS :
    role === "SERVICER" ? SERVICE_SETTINGS :
    role === "SECRETARY" ? SECRETARY_SETTINGS :
    USER_SETTINGS;

  const settingsPrefix = role ? (SETTINGS_PATH_PREFIX[role] ?? "/user/settings") : "/user/settings";

  const badge = role ? ROLE_BADGE[role] : null;

  return (
    <div className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 flex flex-col z-[999] shadow-[4px_0_24px_rgba(0,0,0,0.08)] transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>

      {isOpen ? (
        <>
          {/* Profile Summary Card */}
          <div className="px-5 mt-5 mb-8">
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

          {/* Full Navigation */}
          <nav className="flex-1 px-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isSettings = item.name === "Settings";
              const isOnSettingsPage = pathname.startsWith(settingsPrefix);
              const isActive = isSettings
                ? isOnSettingsPage
                : item.path === menuItems[0].path
                  ? pathname === item.path
                  : pathname === item.path || pathname.startsWith(item.path + "/");

              return (
                <div key={item.name}>
                  {isSettings ? (
                    <button
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className={`w-full group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-black transition-all duration-150 relative outline-none ${isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                        : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-600"}`} />
                        <span className="tracking-tight">{item.name}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 transition-all duration-200 ${settingsOpen ? "rotate-90" : ""} ${isActive ? "text-white opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-emerald-500"}`} />
                    </button>
                  ) : (
                    <Link
                      href={item.path}
                      className={`group flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl text-sm font-black transition-all duration-150 relative outline-none ${isActive
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
                        : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4.5 h-4.5 flex-shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400"} group-hover:text-white`} />
                        <span className="tracking-tight">{item.name}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 transition-all ${isActive ? "text-white opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:text-emerald-500"}`} />
                    </Link>
                  )}

                  {/* Settings Sub-menu */}
                  {isSettings && settingsOpen && (
                    <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-slate-100 pl-3">
                      {settingsChildren.map((sub) => {
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

          {/* Bottom Logout */}
          <div className="px-4 py-6 border-t border-slate-100 mt-auto">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-xs font-black text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all outline-none"
            >
              <LogOut className="w-4 h-4" />
              <span className="tracking-[0.1em] uppercase">Terminate Session</span>
            </button>
          </div>
        </>
      ) : (
        /* Collapsed: icon-only nav */
        <nav className="flex-1 flex flex-col items-center px-2 pt-4 gap-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isSettings = item.name === "Settings";
            const isOnSettingsPage = pathname.startsWith(settingsPrefix);
            const isActive = isSettings
              ? isOnSettingsPage
              : item.path === menuItems[0].path
                ? pathname === item.path
                : pathname === item.path || pathname.startsWith(item.path + "/");

            if (isSettings) {
              return (
                <button
                  key={item.name}
                  onClick={() => { onToggle(); setSettingsOpen(true); }}
                  title={item.name}
                  className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                    isActive ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            }

            return (
              <Link
                key={item.name}
                href={item.path}
                title={item.name}
                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                  isActive ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
              >
                <Icon className="w-4 h-4" />
              </Link>
            );
          })}

          {/* Logout at bottom */}
          <div className="mt-auto pb-4">
            <button
              onClick={logout}
              title="Sign Out"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
