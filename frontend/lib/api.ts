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

    const timerKey = `fetch:${endpoint}:${Date.now()}`;
    try {
        if (isDev) console.time(timerKey);
        const res = await fetch(url, {
            ...fetchOptions,
            headers,
            signal: controller.signal,
        });

        if (isDev) console.timeEnd(timerKey);
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


// ── Emergency SOS API Helpers ──────────────────────────────────────────────────

export interface EmergencyConfig {
    id: string;
    category: string;
    callout_fee: number;
    hourly_rate: number;
    updated_by?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface EmergencyPenaltyConfig {
    id: string;
    event_type: string;
    star_deduction: number;
    updated_by?: string | null;
    updated_at?: string | null;
}

export interface ProviderBasic {
    id: string;
    first_name?: string | null;
    company_name?: string | null;
    owner_name?: string | null;
    category?: string | null;
    rating?: number | null;
    availability_status?: string | null;
    is_verified?: boolean;
}

export interface EmergencyResponseRead {
    id: string;
    request_id: string;
    provider_id: string;
    arrival_time: string;
    status: string;
    penalty_count: number;
    created_at?: string | null;
    updated_at?: string | null;
    provider?: ProviderBasic | null;
}

export interface EmergencyRequestRead {
    id: string;
    user_id: string;
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    category: string;
    description: string;
    device_name?: string | null;
    photos?: string[] | null;
    contact_name: string;
    contact_phone: string;
    status: string;
    config_id?: string | null;
    expires_at: string;
    resulting_booking_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    responses?: EmergencyResponseRead[];
    config?: EmergencyConfig | null;
}

export interface IncomingEmergencyRead {
    id: string;
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    category: string;
    description: string;
    device_name?: string | null;
    photos?: string[] | null;
    contact_name: string;
    contact_phone: string;
    expires_at: string;
    created_at?: string | null;
    callout_fee?: number | null;
    hourly_rate?: number | null;
    has_responded: boolean;
}

export interface EmergencyRequestCreate {
    society_name: string;
    building_name: string;
    flat_no: string;
    landmark: string;
    full_address: string;
    category: string;
    description: string;
    device_name?: string;
    photos?: string[];
    contact_name: string;
    contact_phone: string;
    provider_ids?: string[];
}

export interface EmergencyStarAdjustCreate {
    delta: number;
    reason: string;
}

export interface EmergencyStarAdjustRead {
    id: string;
    provider_id: string;
    adjusted_by: string;
    delta: number;
    reason: string;
    event_type: string;
    emergency_request_id?: string | null;
    created_at?: string | null;
}

// User + Servicer facing
export const emergencyApi = {
    getConfigs: (): Promise<EmergencyConfig[]> =>
        apiFetch("/emergency/config"),

    getProviders: (category?: string): Promise<ProviderBasic[]> =>
        apiFetch(`/emergency/providers${category ? `?category=${encodeURIComponent(category)}` : ""}`),

    create: (body: EmergencyRequestCreate): Promise<EmergencyRequestRead> =>
        apiFetch("/emergency/", { method: "POST", body: JSON.stringify(body) }),

    getRequest: (id: string): Promise<EmergencyRequestRead> =>
        apiFetch(`/emergency/${id}`),

    getActive: (): Promise<EmergencyRequestRead> =>
        apiFetch("/emergency/me/active"),

    accept: (requestId: string, responseId: string): Promise<unknown> =>
        apiFetch(`/emergency/${requestId}/accept/${responseId}`, { method: "POST" }),

    cancel: (requestId: string): Promise<{ detail: string }> =>
        apiFetch(`/emergency/${requestId}/cancel`, { method: "POST" }),

    getIncoming: (): Promise<IncomingEmergencyRead[]> =>
        apiFetch("/emergency/incoming-servicer"),

    respond: (requestId: string, arrival_time: string): Promise<EmergencyResponseRead> =>
        apiFetch(`/emergency/${requestId}/respond`, {
            method: "POST",
            body: JSON.stringify({ arrival_time }),
        }),

    ignore: (requestId: string): Promise<{ detail: string }> =>
        apiFetch(`/emergency/${requestId}/ignore`, { method: "POST" }),
};

// Admin-facing
export const adminEmergencyApi = {
    getConfigs: (): Promise<EmergencyConfig[]> =>
        apiFetch("/admin/emergency/config"),

    createConfig: (body: { category: string; callout_fee: number; hourly_rate: number }): Promise<EmergencyConfig> =>
        apiFetch("/admin/emergency/config", { method: "POST", body: JSON.stringify(body) }),

    updateConfig: (id: string, body: { callout_fee?: number; hourly_rate?: number }): Promise<EmergencyConfig> =>
        apiFetch(`/admin/emergency/config/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

    getPenalties: (): Promise<EmergencyPenaltyConfig[]> =>
        apiFetch("/admin/emergency/penalty"),

    updatePenalty: (eventType: string, star_deduction: number): Promise<EmergencyPenaltyConfig> =>
        apiFetch(`/admin/emergency/penalty/${encodeURIComponent(eventType)}`, {
            method: "PATCH",
            body: JSON.stringify({ star_deduction }),
        }),

    getRequests: (status?: string): Promise<EmergencyRequestRead[]> =>
        apiFetch(`/admin/emergency/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),

    getRequest: (id: string): Promise<EmergencyRequestRead> =>
        apiFetch(`/admin/emergency/requests/${id}`),

    starAdjust: (providerId: string, body: EmergencyStarAdjustCreate): Promise<EmergencyStarAdjustRead> =>
        apiFetch(`/admin/emergency/star-adjust/${providerId}`, {
            method: "POST",
            body: JSON.stringify(body),
        }),

    getStarAdjustments: (providerId: string): Promise<EmergencyStarAdjustRead[]> =>
        apiFetch(`/admin/emergency/star-adjust/${providerId}`),

    updateProviderStatus: (providerId: string, is_active: boolean, reason?: string): Promise<{ detail: string }> =>
        apiFetch(`/admin/emergency/provider/${providerId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ is_active, reason }),
        }),
};

// WebSocket helpers
const WS_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000")
    .replace(/\/$/, "")
    .replace(/^http/, "ws");

export function createUserEmergencySocket(requestId: string): WebSocket {
    return new WebSocket(`${WS_BASE}/ws/emergency/${requestId}`);
}

export function createServicerAlertSocket(providerId: string): WebSocket {
    return new WebSocket(`${WS_BASE}/ws/servicer/alerts?provider_id=${providerId}`);
}
