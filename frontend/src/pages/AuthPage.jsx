import { useState } from "react";
import { apiFetch } from "../api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function updateName(value) {
    setForm((prev) => ({ ...prev, name: value.replace(/[^a-zA-Z ]/g, "") }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const path = mode === "register" ? "/register" : "/login";
      const payload = mode === "register"
        ? { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() }
        : { email: form.email.trim().toLowerCase(), password: form.password };
      const data = await apiFetch(path, { method: "POST", body: JSON.stringify(payload) });
      onLogin(data);
      setForm({ name: "", email: "", password: "" });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero card glass">
        <span className="eyebrow">Your Last Message to Your Loved Ones❣️</span>
        <h1 className="death-title">Quiet Record</h1>
        <p>
          Keep important personal records organized, choose trusted contacts, and manage the inactivity trigger from one clean dashboard.
        </p>
      </div>

      <div className="auth-card card">
        <div className="auth-tabs">
          <button className={mode === "login" ? "" : "secondary"} onClick={() => setMode("login")} type="button">Login</button>
          <button className={mode === "register" ? "" : "secondary"} onClick={() => setMode("register")} type="button">Register</button>
        </div>

        <div className="section-header compact">
          <div>
            <h1>{mode === "register" ? "Create your account" : "Welcome back"}</h1>
            <p>{mode === "register" ? "Set up a account to start managing your records." : "Sign in to continue to your personal workspace."}</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          {mode === "register" ? (
            <input
              placeholder="Full name"
              value={form.name}
              onChange={(e) => updateName(e.target.value)}
              pattern="[A-Za-z ]+"
              title="Use letters and spaces only"
              required
            />
          ) : null}
          <input
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="Password"
            minLength="8"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <button type="submit" disabled={loading}>{loading ? "Please wait..." : mode === "register" ? "Create account" : "Login"}</button>
        </form>

        {message ? <div className="notice warning top-gap">{message}</div> : null}
      </div>
    </div>
  );
}
