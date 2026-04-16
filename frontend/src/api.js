import { clearAllSessionData } from "./storage";

export const API_BASE = "http://127.0.0.1:8000";

export function logout() {
  fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  clearAllSessionData();
}

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem("access_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  let isJson = response.headers.get("content-type")?.includes("application/json");
  let data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    // Auto-refresh token on 401 Unauthorized
    if (response.status === 401 && !path.includes("/login") && !path.includes("/refresh")) {
      const retryOriginalRequest = new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      });

      if (!isRefreshing) {
        isRefreshing = true;
        console.warn(`[AUTH] Access Token Expired on ${path}. Initiating safe refresh queue...`);

        fetch(`${API_BASE}/refresh`, {
          method: "POST",
          credentials: "include", // Browser automatically pulls and attaches the HttpOnly cookie
          headers: { "Content-Type": "application/json" }
        })
          .then(async (refreshRes) => {
            if (refreshRes.ok) {
              const newTokens = await refreshRes.json();
              localStorage.setItem("access_token", newTokens.access_token);
              
              console.log("[AUTH] Refresh successful. Resuming queued API requests.");
              processQueue(null, newTokens.access_token);
            } else {
              console.error("[AUTH] Refresh Token fully expired. Logging out.");
              processQueue(new Error("Refresh token expired."));
              logout();
              window.location.reload();
            }
          })
          .catch((err) => {
            console.error("[AUTH] Refresh API failed:", err);
            processQueue(err);
            logout();
            window.location.reload();
          })
          .finally(() => {
            isRefreshing = false;
          });
      }

      try {
        // Wait for the queue to process the new token
        const newAccessToken = await retryOriginalRequest;
        
        headers["Authorization"] = `Bearer ${newAccessToken}`;
        const retriedResponse = await fetch(`${API_BASE}${path}`, {
          credentials: "include",
          ...options,
          headers,
        });

        const isJson = retriedResponse.headers.get("content-type")?.includes("application/json");
        const data = isJson ? await retriedResponse.json() : await retriedResponse.text();

        if (retriedResponse.ok) {
          return data;
        } else {
          throw new Error(data?.detail || "Request failed even after token refresh.");
        }
      } catch (err) {
        throw new Error("Session expired and could not be restored.");
      }
    }
    
    if (response.status === 401 && path.includes("/refresh")) {
        logout();
        window.location.reload();
    }

    const message = typeof data === "object" && data?.detail ? data.detail : "Request failed";
    throw new Error(message);
  }

  return data;
}
