import { useState } from "react";
import "./AuthPage.css";
import { apiFetch } from "../../api";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login, register, forgot
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
      if (mode === "register") {
        const payload = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() };
        await apiFetch("/register", { method: "POST", body: JSON.stringify(payload) });
        // After registration, auto-login or switch to login mode
        setMode("login");
        setMessage("Registration successful! Please login.");
        setLoading(false);
        return;
      }

      // Login Flow
      const formData = new URLSearchParams();
      formData.append("username", form.email.trim().toLowerCase());
      formData.append("password", form.password);

      const tokenData = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      // Store token
      localStorage.setItem("access_token", tokenData.access_token);

      // Fetch user profile
      const user = await apiFetch("/me");
      onLogin(user);
      setForm({ name: "", email: "", password: "" });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await apiFetch("/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      });
      setMessage(response.message);
      // Don't switch mode immediately, let them see the message
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero card glass">
        <div className="cosmic-visualizer">
          <div className="cosmic-core"></div>
          <div className="cosmic-orbit orbit-1"><div className="planet planet-1"></div></div>
          <div className="cosmic-orbit orbit-2"><div className="planet planet-2"></div></div>
          <div className="cosmic-orbit orbit-3"><div className="planet planet-3"></div></div>
        </div>
        <span className="eyebrow">Your Last Message to Your Loved Ones❣️</span>
        <h1 className="death-title">Galaxio</h1>
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
            <h1>
              {mode === "register" ? "Create your account" : 
               mode === "forgot" ? "Reset your password" : "Welcome back"}
            </h1>
            <p>
              {mode === "register" ? "Set up a account to start managing your records." : 
               mode === "forgot" ? "Enter your email to receive a password reset link." : "Sign in to continue to your personal workspace."}
            </p>
          </div>
        </div>

        {mode === "forgot" ? (
          <form className="form-grid" onSubmit={handleForgotPassword}>
            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <button type="submit" disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
            <button className="text-button" type="button" onClick={() => setMode("login")}>Back to login</button>
          </form>
        ) : (
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
            {mode === "login" && (
              <div className="form-options">
                <button 
                  className="text-button small" 
                  type="button" 
                  onClick={() => setMode("forgot")}
                >
                  Forgot your password?
                </button>
              </div>
            )}
            <button type="submit" disabled={loading}>{loading ? "Please wait..." : mode === "register" ? "Create account" : "Login"}</button>
          </form>
        )}

        {message ? <div className="notice warning top-gap">{message}</div> : null}
      </div>
    </div>
  );
}
