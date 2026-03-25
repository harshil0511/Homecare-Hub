/**
 * Auth helpers for Homecare Hub
 * Stores role, username, and JWT token in localStorage
 * after a successful login.
 */

// Keys used in localStorage
const TOKEN_KEY = "hc_token";
const ROLE_KEY = "hc_role";
const USERNAME_KEY = "hc_username";
const UUID_KEY = "hc_uuid";

// Save all auth data at once after login
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
}

// Get the raw JWT token
export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

// Get the logged-in user's role: "USER" | "SERVICER" | "ADMIN"
export function getRole(): string | null {
    return localStorage.getItem(ROLE_KEY);
}

// Get the logged-in user's display name
export function getUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
}

// Role boolean helpers — easy to use in components
export function isAdmin(): boolean {
    return getRole() === "ADMIN";
}

export function isServicer(): boolean {
    return getRole() === "SERVICER";
}

export function isUser(): boolean {
    return getRole() === "USER";
}

// Check if there is any active session
export function isLoggedIn(): boolean {
    return !!getToken();
}

// Clear all session data and redirect to login
export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(UUID_KEY);
    window.location.href = "/login";
}

// Legacy compat — some old code calls saveToken directly
export function saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}
