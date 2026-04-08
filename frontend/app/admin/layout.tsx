"use client";
import { useState } from "react";
import AuthGuard from "@/components/layout/AuthGuard";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import BackendStatus from "@/components/layout/BackendStatus";
import { ToastProvider } from "@/lib/toast-context";
import ToastContainer from "@/components/ui/ToastContainer";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggle = () => setSidebarOpen(prev => !prev);
  return (
    <ToastProvider>
      <AuthGuard>
        <BackendStatus />
        <Navbar onMenuToggle={toggle} isSidebarOpen={sidebarOpen} />
        <Sidebar isOpen={sidebarOpen} onToggle={toggle} />
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/50 z-[998] md:hidden" onClick={() => setSidebarOpen(false)} />
        )}
        <main className={`pt-16 min-h-screen bg-slate-50 transition-all duration-300 ${sidebarOpen ? "md:pl-64" : "md:pl-16"}`}>
          <div className="px-4 sm:px-8 py-5 sm:py-7 max-w-7xl mx-auto animate-fade-in">
            {children}
          </div>
        </main>
        <ToastContainer />
      </AuthGuard>
    </ToastProvider>
  );
}
