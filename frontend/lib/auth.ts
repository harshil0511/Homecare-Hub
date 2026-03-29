/**
 * Auth helpers for Homecare Hub
 * Stores role, username, and JWT token in localStorage + cookie (for middleware).
 */

const TOKEN_KEY = "hc_token";
const ROLE_KEY = "hc_role";
const USERNAME_KEY = "hc_username";
const UUID_KEY = "hc_uuid";

const ROLE_HOME: Record<string, string> = {
    ADMIN: "/admin/dashboard",
    SECRETARY: "/secretary/dashboard",
    USER: "/user/dashboard",
    SERVICER: "/service/dashboard",
};

export function saveAuthData(data: {
    access_token: string;
    role: string;
    username: string;
    user_uuid: string;
}) {
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(ROLE_KEY, data.role);
    localStorage.setItem(USERNAME_KEY, data.username);
    localStorage.setItem(UUID_KEY, data.user_uuid);
    // Write cookie so Next.js middleware can check token existence
    document.cookie = `hc_token=${data.access_token}; path=/; SameSite=Strict; Max-Age=3600`;
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): string | null {
    return localStorage.getItem(ROLE_KEY);
}

export function getUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
}

export function isAdmin(): boolean {
    return getRole() === "ADMIN";
}

export function isServicer(): boolean {
    return getRole() === "SERVICER";
}

export function isUser(): boolean {
    return getRole() === "USER";
}

export function isSecretary(): boolean {
    return getRole() === "SECRETARY";
}

export function isLoggedIn(): boolean {
    return !!getToken();
}

export function getRoleHome(): string {
    const role = getRole();
    return role ? (ROLE_HOME[role] ?? "/login") : "/login";
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(UUID_KEY);
    // Clear cookie
    document.cookie = "hc_token=; path=/; Max-Age=0";
    window.location.href = "/login";
}

// Legacy compat
export function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}
