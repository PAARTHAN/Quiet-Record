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
      setMessage("Missing or invalid reset token. Please use the password reset link sent to your email.");
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
    <div className="auth-page reset-container">
      <div className="auth-hero card glass">
        <span className="eyebrow">Secure Security Update 🔒</span>
        <h1 className="death-title">Quiet Record</h1>
        <p>
          Update your credentials to maintain secure access to your digital legacy and personal records.
        </p>
      </div>

      <div className="auth-card card glass">
        {!success ? (
          <>
            <div className="section-header compact">
              <div>
                <h1>Set New Password</h1>
                <p>Choose a strong, unique password to protect your account.</p>
              </div>
            </div>

            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="input-group">
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength="8"
                  required
                  className="premium-input"
                />
              </div>
              <div className="input-group">
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength="8"
                  required
                  className="premium-input"
                />
              </div>
              
              {message && (
                <div className="notice warning top-gap">
                  {message}
                </div>
              )}

              <button type="submit" className="primary-btn" disabled={loading || !token}>
                {loading ? "Updating Security..." : "Reset My Password"}
              </button>
            </form>
          </>
        ) : (
          <div className="success-state">
            <div className="success-icon">✓</div>
            <h1>Success!</h1>
            <p>{message}</p>
            <div className="redirect-hint">Redirecting to login in a few seconds...</div>
            <button className="primary-btn top-gap" onClick={() => navigate("/")}>
              Login Now
            </button>
          </div>
        )}

        {!success && (
          <button className="text-button top-gap" onClick={() => navigate("/")}>
            ← Back to login
          </button>
        )}
      </div>
    </div>
  );
}
