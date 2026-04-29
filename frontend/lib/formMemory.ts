const MAX_ENTRIES = 5;

function storageKey(fieldKey: string): string {
    return `hc_mem_${fieldKey}`;
}

export function getMemory(fieldKey: string): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(storageKey(fieldKey));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function addMemory(fieldKey: string, value: string): void {
    if (typeof window === "undefined") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    try {
        const existing = getMemory(fieldKey).filter(v => v !== trimmed);
        const updated = [trimmed, ...existing].slice(0, MAX_ENTRIES);
        localStorage.setItem(storageKey(fieldKey), JSON.stringify(updated));
    } catch {
        // ignore storage errors
    }
}

export function saveFormMemory(fields: Record<string, string>): void {
    Object.entries(fields).forEach(([key, value]) => {
        if (value?.trim()) addMemory(key, value);
    });
}
