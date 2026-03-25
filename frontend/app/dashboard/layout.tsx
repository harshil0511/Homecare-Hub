"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/layout/Navbar";
import Sidebar from "@/components/layout/Sidebar";
import BackendStatus from "@/components/layout/BackendStatus";
import AuthGuard from "@/components/layout/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-50">
        <BackendStatus />
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto px-8 py-7">
            <div className="max-w-7xl mx-auto animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
