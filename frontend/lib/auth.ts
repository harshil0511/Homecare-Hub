/**
 * Auth helpers for Homecare Hub
 * Each role stores its own token independently — all 4 roles can be logged in simultaneously.
 * Token keys: hc_token_ADMIN, hc_token_USER, hc_token_SERVICER, hc_token_SECRETARY
 */

const ROLE_TOKEN_KEY: Record<string, string> = {
    ADMIN:     "hc_token_ADMIN",
    USER:      "hc_token_USER",
    SERVICER:  "hc_token_SERVICER",
    SECRETARY: "hc_token_SECRETARY",
};

const ROLE_HOME: Record<string, string> = {
    ADMIN:     "/admin/dashboard",
    SECRETARY: "/secretary/dashboard",
    USER:      "/user/dashboard",
    SERVICER:  "/service/dashboard",
};

/** Detect which role the current URL belongs to. */
export function getRoleFromPath(pathname?: string): string | null {
    const p = pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
    if (p.startsWith("/admin"))     return "ADMIN";
    if (p.startsWith("/user"))      return "USER";
    if (p.startsWith("/service"))   return "SERVICER";
    if (p.startsWith("/secretary")) return "SECRETARY";
    return null;
}

/** Save auth data for a specific role. Does not affect other roles' tokens. */
export function saveAuthData(data: {
    access_token: string;
    role: string;
    username: string;
    user_uuid: string;
}) {
    const key = ROLE_TOKEN_KEY[data.role];
    if (!key) return;

    sessionStorage.setItem(key, data.access_token);
    sessionStorage.setItem(`hc_username_${data.role}`, data.username);
    sessionStorage.setItem(`hc_uuid_${data.role}`, data.user_uuid);

    // Write role-specific cookie for middleware
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${key}=${data.access_token}; path=/; SameSite=Strict; Max-Age=3600${secure}`;
}

/** Get token for a specific role. */
export function getTokenForRole(role: string): string | null {
    const key = ROLE_TOKEN_KEY[role];
    return key ? sessionStorage.getItem(key) : null;
}

/** Get token for the role matching the current URL. */
export function getToken(): string | null {
    const role = getRoleFromPath();
    if (role) return getTokenForRole(role);
    // Fallback: return any available token
    for (const r of Object.keys(ROLE_TOKEN_KEY)) {
        const t = getTokenForRole(r);
        if (t) return t;
    }
    return null;
}

/** Check if a specific role is logged in. */
export function isRoleLoggedIn(role: string): boolean {
    return !!getTokenForRole(role);
}

/** Check if the current route's role is logged in. */
export function isLoggedIn(): boolean {
    const role = getRoleFromPath();
    if (role) return isRoleLoggedIn(role);
    return false;
}

/** Get role for the current URL path. */
export function getRole(): string | null {
    return getRoleFromPath();
}

/** Get username for a specific role. */
export function getUsernameForRole(role: string): string | null {
    return sessionStorage.getItem(`hc_username_${role}`);
}

/** Get username for the current URL's role. */
export function getUsername(): string | null {
    const role = getRoleFromPath();
    return role ? getUsernameForRole(role) : null;
}

export function getRoleHome(role?: string): string {
    const r = role ?? getRole();
    return r ? (ROLE_HOME[r] ?? "/login") : "/login";
}

/** Logout only the specified role — other roles remain logged in. */
export function logoutRole(role: string) {
    const key = ROLE_TOKEN_KEY[role];
    if (key) {
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(`hc_username_${role}`);
        sessionStorage.removeItem(`hc_uuid_${role}`);
        const secure = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${key}=; path=/; Max-Age=0${secure}`;
    }
    window.location.href = "/login";
}

/** Logout current route's role. */
export function logout() {
    const role = getRoleFromPath();
    if (role) {
        logoutRole(role);
    } else {
        window.location.href = "/login";
    }
}

// Legacy compat
export function isAdmin():     boolean { return isRoleLoggedIn("ADMIN"); }
export function isServicer():  boolean { return isRoleLoggedIn("SERVICER"); }
export function isUser():      boolean { return isRoleLoggedIn("USER"); }
export function isSecretary(): boolean { return isRoleLoggedIn("SECRETARY"); }

/** @deprecated Use saveAuthData instead */
export function saveToken(token: string) {
    sessionStorage.setItem("hc_token", token);
}
