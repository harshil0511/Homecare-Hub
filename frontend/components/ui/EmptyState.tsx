import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick?: () => void;
        href?: string;
    };
    py?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, py = "py-16" }: EmptyStateProps) {
    return (
        <div className={`${py} flex flex-col items-center text-center gap-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200`}>
            <Icon className="w-10 h-10 text-slate-300" />
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{title}</p>
            {description && (
                <p className="text-[10px] text-slate-400 max-w-xs w-full">{description}</p>
            )}
            {action && (
                action.href ? (
                    <a href={action.href} className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                        {action.label} →
                    </a>
                ) : (
                    <button onClick={action.onClick} className="text-[10px] font-black text-[#064e3b] uppercase tracking-widest hover:underline">
                        {action.label} →
                    </button>
                )
            )}
        </div>
    );
}
