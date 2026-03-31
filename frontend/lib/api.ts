const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const API = API_BASE + "/api/v1";

interface ApiOptions extends RequestInit {
    timeout?: number;
}

export async function apiFetch(endpoint: string, options: ApiOptions = {}) {
    const { timeout = 10000, ...fetchOptions } = options;

    // Get the token for the role that owns the current URL
    const token = typeof window !== "undefined"
        ? (() => {
            const p = window.location.pathname;
            const roleKey =
                p.startsWith("/admin")     ? "hc_token_ADMIN" :
                p.startsWith("/user")      ? "hc_token_USER" :
                p.startsWith("/service")   ? "hc_token_SERVICER" :
                p.startsWith("/secretary") ? "hc_token_SECRETARY" :
                null;
            if (roleKey) return localStorage.getItem(roleKey);
            // Fallback: any available token
            for (const k of ["hc_token_ADMIN","hc_token_USER","hc_token_SERVICER","hc_token_SECRETARY"]) {
                const t = localStorage.getItem(k);
                if (t) return t;
            }
            return null;
        })()
        : null;

    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

    const headers: Record<string, string> = {
        ...(token && { Authorization: `Bearer ${token}` }),
        ...fetchOptions.headers as Record<string, string>,
    };

    if (!isFormData) {
        headers["Content-Type"] = "application/json";
    }

    // Performance: AbortController for timeouts
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const url = `${API}${endpoint}`;
    const isDev = process.env.NODE_ENV === "development";
    if (isDev) console.log(`🚀 [apiFetch] Requesting: ${url}`);

    try {
        if (isDev) console.time(`fetch:${endpoint}`);
        const res = await fetch(url, {
            ...fetchOptions,
            headers,
            signal: controller.signal,
        });

        if (isDev) console.timeEnd(`fetch:${endpoint}`);
        clearTimeout(id);

        if (!res.ok) {
            let errorMessage = "Something went wrong. Please try again.";
            try {
                const errorBody = await res.json();
                // Only surface detail for client errors (4xx); hide server error internals (5xx)
                if (res.status < 500) {
                    if (typeof errorBody.detail === "string") {
                        errorMessage = errorBody.detail;
                    } else if (Array.isArray(errorBody.detail)) {
                        errorMessage = errorBody.detail.map((e: { msg: string }) => e.msg).join(", ");
                    }
                }
            } catch {
                errorMessage = res.status < 500 ? (res.statusText || errorMessage) : errorMessage;
            }

            // Centralized Auth Handling
            if (res.status === 401 && typeof window !== "undefined") {
                // Clear only the current route's role token
                const p = window.location.pathname;
                const roleKey =
                    p.startsWith("/admin")     ? "hc_token_ADMIN" :
                    p.startsWith("/user")      ? "hc_token_USER" :
                    p.startsWith("/service")   ? "hc_token_SERVICER" :
                    p.startsWith("/secretary") ? "hc_token_SECRETARY" : null;
                if (roleKey) localStorage.removeItem(roleKey);
                window.location.href = "/login";
            }

            throw new Error(errorMessage);
        }

        // Handle empty responses (204 No Content, etc.)
        const text = await res.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            throw new Error("Received an invalid response from the server.");
        }
    } catch (err: any) {
        clearTimeout(id);
        if (err.name === 'AbortError') {
            throw new Error("Request timed out. Please check your connection.");
        }
        throw err;
    }
}

