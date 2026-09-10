import { useState } from "react";
import { apiFetch } from "../../api";
import "./AuthPage.css";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        const payload = { ...form, name: form.name.trim(), email: form.email.trim().toLowerCase() };
        await apiFetch("/register", { method: "POST", body: JSON.stringify(payload) });
        setMode("login");
        setMessage("Account created. Sign in to continue.");
        setLoading(false);
        return;
      }

      const formData = new URLSearchParams();
      formData.append("username", form.email.trim().toLowerCase());
      formData.append("password", form.password);

      const tokenData = await apiFetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      localStorage.setItem("access_token", tokenData.access_token);
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
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div className="auth-hero__inner">
          <div className="auth-mark">
            Quiet Record
            <em>Est. for the things that outlast us</em>
          </div>

          <h1>A ledger for your whole financial life — and a hand on it when yours is gone.</h1>

          <p>
            Keep what you own, what you owe and what is owed to you in one clear record. Get honest guidance on
            managing it while you are here. And know that if you ever fall silent, the people you trust will
            receive it all, in order, without a search.
          </p>

          <ul className="auth-points">
            <li><strong>The ledger.</strong> Debts, receivables, policies, property, holdings — all in one place.</li>
            <li><strong>The advisor.</strong> Your net worth, health score, target mix and a monthly plan, worked from your own figures.</li>
            <li><strong>The watch.</strong> A quiet inactivity timer that hands everything to your trusted circle if it ever runs out.</li>
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <div className="card auth-card">
          {mode !== "forgot" ? (
            <div className="segmented auth-tabs">
              <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>
                Sign in
              </button>
              <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")}>
                Create account
              </button>
            </div>
          ) : null}

          <div className="section-header compact auth-heading">
            <div>
              <h1>
                {mode === "register" ? "Open your record" : mode === "forgot" ? "Reset your password" : "Welcome back"}
              </h1>
              <p>
                {mode === "register"
                  ? "A few seconds to start; the record grows with you."
                  : mode === "forgot"
                    ? "We will send a reset link to your email."
                    : "Sign in to your private workspace."}
              </p>
            </div>
          </div>

          {mode === "forgot" ? (
            <form className="form-grid" onSubmit={handleForgotPassword}>
              <div className="field">
                <label htmlFor="reset-email">Email address</label>
                <input id="reset-email" type="email" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <button type="submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
              <button className="link-btn" type="button" onClick={() => setMode("login")}>Back to sign in</button>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" value={form.name}
                         onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, "") })}
                         pattern="[A-Za-z ]+" title="Letters and spaces only" required />
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="email">Email address</label>
                <input id="email" type="email" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" minLength="8" value={form.password}
                       onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                {mode === "register" ? <span className="hint">At least eight characters.</span> : null}
              </div>

              {mode === "login" ? (
                <button className="link-btn auth-forgot" type="button" onClick={() => setMode("forgot")}>
                  Forgotten your password?
                </button>
              ) : null}

              <button type="submit" disabled={loading}>
                {loading ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>
          )}

          {message ? <div className="notice warning top-gap">{message}</div> : null}
        </div>

        <p className="auth-footnote">
          Your records are stored against your account and released only by the trigger you control.
        </p>
      </section>
    </div>
  );
}
