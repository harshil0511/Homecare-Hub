import Link from "next/link";
import { Home } from "lucide-react";

export default function InfoLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Minimal public header — no API calls, no auth */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-100 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-[#064e3b] font-black uppercase tracking-widest text-sm hover:opacity-80 transition-opacity">
                        <Home className="w-4 h-4" />
                        Homecare Hub
                    </Link>
                    <Link
                        href="/login"
                        className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        Login →
                    </Link>
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-6 py-8">
                {children}
            </main>
        </div>
    );
}
