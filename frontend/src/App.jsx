import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import AuthPage from "./pages/Auth/AuthPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import RecordsPage from "./pages/Records/RecordsPage";
import ContactsPage from "./pages/Contacts/ContactsPage";
import TriggerPage from "./pages/Trigger/TriggerPage";
import ProfilePage from "./pages/Profile/ProfilePage";
import ResetPasswordPage from "./pages/Auth/ResetPasswordPage";
import { apiFetch, logout as apiLogout, API_BASE } from "./api";
import { getStoredUser, setStoredUser } from "./storage";

export default function App() {
  const [user, setUserState] = useState(() => getStoredUser());
  const [records, setRecords] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [triggerStatus, setTriggerStatus] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // One-time cleanup of legacy keys
  useEffect(() => {
    const legacyKeys = ["digital_legacy_sensitive_data", "dls_records", "token", "user", "refresh_token"];
    const hasLegacy = legacyKeys.some(key => localStorage.getItem(key));
    if (hasLegacy) {
      legacyKeys.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem("digital_legacy_user");
      localStorage.removeItem("dls_user");
    }
  }, []);

  // Sync state with storage
  function setUser(value) {
    setUserState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setStoredUser(next);
      return next;
    });
  }

  // Restore session on load
  useEffect(() => {
    async function restoreSession() {
      const token = localStorage.getItem("access_token");
      if (token) {
        try {
          const profile = await apiFetch("/me");
          setUser(profile);
        } catch (error) {
          console.error("Session restore failed", error);
          apiLogout();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setAuthChecking(false);
    }
    restoreSession();
  }, []);

  useEffect(() => {
    fetch(API_BASE)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.message))
      .catch(() => setBackendStatus("Could not connect to backend"));
  }, []);

  async function loadRecords() {
    try {
      const data = await apiFetch("/records");
      setRecords(data);
    } catch (error) {
      if (error.message.includes("Unauthorized") || error.message.includes("401")) {
        apiLogout();
        setUser(null);
      }
      setRecords([]);
    }
  }

  async function loadContacts() {
    try {
      const data = await apiFetch("/contacts");
      setContacts(data);
    } catch (error) {
      if (error.message.includes("Unauthorized") || error.message.includes("401")) {
        apiLogout();
        setUser(null);
      }
      setContacts([]);
    }
  }

  async function loadStatus(cancelled = false) {
    if (!localStorage.getItem("access_token")) return;
    try {
      const data = await apiFetch("/trigger/status");
      if (cancelled) return;
      
      setTriggerStatus(data);
      setUser((prev) => {
        if (!prev) return null;
        if (
          prev.last_check_in === data.last_check_in &&
          prev.is_triggered === data.is_triggered &&
          prev.warning_sent === data.warning_sent
        ) {
          return prev;
        }
        return {
          ...prev,
          last_check_in: data.last_check_in,
          is_triggered: data.is_triggered,
          warning_sent: data.warning_sent,
        };
      });
    } catch (error) {
      if (!cancelled) {
        if (error.message.includes("Unauthorized") || error.message.includes("401")) {
          apiLogout();
          setUser(null);
        }
        setTriggerStatus(null);
      }
    }
  }

  useEffect(() => {
    if (!user?.id) return;
    loadRecords();
    loadContacts();
    
    // Initial fetch to paint the UI immediately
    let cancelledRef = { current: false };
    loadStatus(cancelledRef.current);
    
    // Set up WebSocket connection for real-time updates
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const wsUrl = `${API_BASE.replace(/^http/, 'ws')}/trigger/ws/status?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTriggerStatus(data);
        setUser((prev) => {
          if (!prev) return null;
          if (
            prev.last_check_in === data.last_check_in &&
            prev.is_triggered === data.is_triggered &&
            prev.warning_sent === data.warning_sent
          ) {
            return prev;
          }
          return {
            ...prev,
            last_check_in: data.last_check_in,
            is_triggered: data.is_triggered,
            warning_sent: data.warning_sent,
          };
        });
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      if (cancelledRef.current) return;
      console.error("WebSocket Error:", error);
    };

    return () => {
      cancelledRef.current = true;
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user?.id]);

  // Global Timer Interpolator: Keep triggerStatus fresh every second
  useEffect(() => {
    if (!triggerStatus || !triggerStatus.is_timer_active || triggerStatus.is_triggered) return;

    const timer = setInterval(() => {
      setTriggerStatus((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          seconds_until_trigger: Math.max(0, prev.seconds_until_trigger - 1),
          seconds_until_warning: Math.max(0, prev.seconds_until_warning - 1),
          seconds_since_check_in: prev.seconds_since_check_in + 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [triggerStatus?.is_timer_active, triggerStatus?.is_triggered]);

  function handleLogout() {
    apiLogout();
    setUser(null);
  }

  if (authChecking) {
    return <div className="loading-screen">Restoring session...</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthPage onLogin={setUser} backendStatus={backendStatus} />} />
      </Routes>
    );
  }

  return (
    <Layout user={user} onLogout={handleLogout} backendStatus={backendStatus} triggerStatus={triggerStatus}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} records={records} contacts={contacts} triggerStatus={triggerStatus} />} />
        <Route path="/records" element={<RecordsPage user={user} records={records} loadRecords={loadRecords} />} />
        <Route path="/contacts" element={<ContactsPage user={user} contacts={contacts} loadContacts={loadContacts} />} />
        <Route path="/trigger" element={<TriggerPage user={user} setUser={setUser} records={records} contacts={contacts} triggerStatus={triggerStatus} refreshStatus={() => loadStatus(false)} />} />
        <Route path="/profile" element={<ProfilePage user={user} records={records} contacts={contacts} triggerStatus={triggerStatus} setUser={setUser} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
