"use client";
import { useState } from "react";
import AuthGuard from "@/components/layout/AuthGuard";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import BackendStatus from "@/components/layout/BackendStatus";

export default function SecretaryLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggle = () => setSidebarOpen(prev => !prev);
  return (
    <AuthGuard>
      <BackendStatus />
      <Navbar onMenuToggle={toggle} isSidebarOpen={sidebarOpen} />
      <Sidebar isOpen={sidebarOpen} onToggle={toggle} />
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-[998] md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <main className={`pt-16 min-h-screen bg-slate-50 transition-all duration-300 ${sidebarOpen ? "md:pl-64" : ""}`}>
        <div className="px-8 py-7 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </AuthGuard>
  );
}
