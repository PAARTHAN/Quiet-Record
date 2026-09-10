import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api";
import "./AuthPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setMessage("That link is missing its reset token. Use the link from your email.");
    }
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token) {
      setMessage("Missing reset token. Please use the link sent to your email.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await apiFetch("/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      setSuccess(true);
      setMessage("Your password has been securely updated.");
      setTimeout(() => {
        navigate("/");
      }, 5000);
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
          <h1>Set a new password.</h1>
          <p>
            Choose something you have not used elsewhere. Your records stay exactly as you left them.
          </p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="card auth-card">
        {!success ? (
          <>
            <div className="section-header compact auth-heading">
              <div>
                <h1>New password</h1>
                <p>At least eight characters, and different from the last one.</p>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength="8"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength="8"
                  required
                />
              </div>
              
              {message && (
                <div className="notice warning top-gap">
                  {message}
                </div>
              )}

              <button type="submit" disabled={loading || !token}>
                {loading ? "Updating…" : "Set new password"}
              </button>
            </form>
          </>
        ) : (
          <div className="success-state">
            <div className="success-icon" aria-hidden="true">✓</div>
            <h1>Password updated</h1>
            <p>{message}</p>
            <div className="redirect-hint">Taking you to sign in shortly…</div>
            <button className="top-gap" onClick={() => navigate("/")}>Sign in now</button>
          </div>
        )}

          {!success && (
            <button className="link-btn top-gap" onClick={() => navigate("/")}>
              ← Back to sign in
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
