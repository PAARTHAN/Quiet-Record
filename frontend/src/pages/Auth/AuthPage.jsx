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
        setMessage("Account created. Now sign in.");
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
            <em>Your money, in one place</em>
          </div>

          <h1>Everything you own, written down once — and passed on if you are not there to explain it.</h1>

          <p>
            Most families lose track of what someone had. A bank account nobody knew about, a policy nobody
            claimed, a loan nobody repaid. Write it down once here, get plain advice on what to do with it while
            you are around, and know that the people you trust will be given all of it if you are not.
          </p>

          <ul className="auth-points">
            <li><strong>Write it down.</strong> Savings, loans, insurance, property, money people owe you.</li>
            <li><strong>Know what to do.</strong> What you are worth, how you are doing, and what to do with your money each month — in plain words.</li>
            <li><strong>Pass it on.</strong> If you ever stop checking in, everything goes to the people you name.</li>
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
                {mode === "register" ? "Create your account" : mode === "forgot" ? "Forgotten password" : "Welcome back"}
              </h1>
              <p>
                {mode === "register"
                  ? "It takes a minute. You can add things as you go."
                  : mode === "forgot"
                    ? "We will email you a link to set a new one."
                    : "Sign in to see your list."}
              </p>
            </div>
          </div>

          {mode === "forgot" ? (
            <form className="form-grid" onSubmit={handleForgotPassword}>
              <div className="field">
                <label htmlFor="reset-email">Your email</label>
                <input id="reset-email" type="email" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <button type="submit" disabled={loading}>{loading ? "Sending…" : "Email me a link"}</button>
              <button className="link-btn" type="button" onClick={() => setMode("login")}>Back to sign in</button>
            </form>
          ) : (
            <form className="form-grid" onSubmit={handleSubmit}>
              {mode === "register" ? (
                <div className="field">
                  <label htmlFor="name">Your name</label>
                  <input id="name" value={form.name}
                         onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, "") })}
                         pattern="[A-Za-z ]+" title="Letters and spaces only" required />
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="email">Your email</label>
                <input id="email" type="email" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>

              <div className="field">
                <label htmlFor="password">A password</label>
                <input id="password" type="password" minLength="8" value={form.password}
                       onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                {mode === "register" ? <span className="hint">At least eight letters or numbers.</span> : null}
              </div>

              {mode === "login" ? (
                <button className="link-btn auth-forgot" type="button" onClick={() => setMode("forgot")}>
                  Forgotten your password?
                </button>
              ) : null}

              <button type="submit" disabled={loading}>
                {loading ? "Please wait…" : mode === "register" ? "Create my account" : "Sign in"}
              </button>
            </form>
          )}

          {message ? <div className="notice warning top-gap">{message}</div> : null}
        </div>

        <p className="auth-footnote">
          Only you can see your list. Nothing is sent to anyone unless you stop checking in.
        </p>
      </section>
    </div>
  );
}
