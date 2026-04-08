interface SpinnerProps {
    size?: "sm" | "md" | "lg";
    py?: string;
}

export default function Spinner({ size = "md", py = "py-16" }: SpinnerProps) {
    const dim =
        size === "sm" ? "w-4 h-4 border-2" :
        size === "lg" ? "w-8 h-8 border-4" :
        "w-6 h-6 border-2";

    return (
        <div className={`${py} flex items-center justify-center`}>
            <div className={`${dim} border-[#064e3b] border-t-transparent rounded-full animate-spin`} />
        </div>
    );
}
