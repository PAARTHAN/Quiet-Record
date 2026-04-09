import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import RecordsPage from "./pages/RecordsPage";
import ContactsPage from "./pages/ContactsPage";
import TriggerPage from "./pages/TriggerPage";
import ProfilePage from "./pages/ProfilePage";
import { apiFetch } from "./api";
import { getStoredUser, setStoredUser } from "./storage";

export default function App() {
  const [user, setUserState] = useState(() => getStoredUser());
  const [records, setRecords] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [backendStatus, setBackendStatus] = useState("Checking backend...");
  const [triggerStatus, setTriggerStatus] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/")
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.message))
      .catch(() => setBackendStatus("Could not connect to backend"));
  }, []);

  function setUser(value) {
    setUserState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      setStoredUser(next);
      return next;
    });
  }

  async function loadRecords(userId) {
    try {
      const data = await apiFetch(`/records/${userId}`);
      setRecords(data);
    } catch (error) {
      if (error.message === "User not found") {
        setUser(null);
      }
      setRecords([]);
    }
  }

  async function loadContacts(userId) {
    try {
      const data = await apiFetch(`/contacts/${userId}`);
      setContacts(data);
    } catch (error) {
      if (error.message === "User not found") {
        setUser(null);
      }
      setContacts([]);
    }
  }

  useEffect(() => {
    if (!user) {
      setRecords([]);
      setContacts([]);
      setTriggerStatus(null);
      return;
    }
    loadRecords(user.id);
    loadContacts(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return undefined;

    let cancelled = false;
    async function loadStatus() {
      try {
        const data = await apiFetch(`/trigger-status/${user.id}`);
        if (!cancelled) {
          setTriggerStatus(data);
          setUser((prev) =>
            prev
              ? {
                ...prev,
                last_check_in: data.last_check_in,
                is_triggered: data.is_triggered,
                warning_sent: data.warning_sent,
              }
              : prev,
          );
        }
      } catch (error) {
        if (!cancelled) {
          if (error.message === "User not found") {
            setUser(null);
          }
          setTriggerStatus(null);
        }
      }
    }

    loadStatus();
    const interval = setInterval(loadStatus, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.id]);

  function handleLogout() {
    setUser(null);
  }

  if (!user) {
    return <AuthPage onLogin={setUser} backendStatus={backendStatus} />;
  }

  return (
    <Layout user={user} onLogout={handleLogout} backendStatus={backendStatus} triggerStatus={triggerStatus}>
      <Routes>
        <Route path="/" element={<DashboardPage user={user} records={records} contacts={contacts} triggerStatus={triggerStatus} />} />
        <Route path="/records" element={<RecordsPage user={user} records={records} loadRecords={loadRecords} />} />
        <Route path="/contacts" element={<ContactsPage user={user} contacts={contacts} loadContacts={loadContacts} />} />
        <Route path="/trigger" element={<TriggerPage user={user} setUser={setUser} records={records} contacts={contacts} triggerStatus={triggerStatus} />} />
        <Route path="/profile" element={<ProfilePage user={user} records={records} contacts={contacts} triggerStatus={triggerStatus} setUser={setUser} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
