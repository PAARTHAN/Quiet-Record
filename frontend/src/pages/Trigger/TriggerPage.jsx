import { useEffect, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import { formatServerDate } from "../../storage";
import "./TriggerPage.css";

export default function TriggerPage({ user, setUser, records, contacts, triggerStatus }) {
  const [messages, setMessages] = useState({ checkIn: "", trigger: "", warning: "" });
  const [sending, setSending] = useState(false);
  const shownTriggeredAlertRef = useRef(false);
  const shownWarningAlertRef = useRef(false);

  const setAutoMessage = (key, text) => {
    setMessages((prev) => ({ ...prev, [key]: text }));
    setTimeout(() => {
      setMessages((prev) => ({ ...prev, [key]: "" }));
    }, 5000);
  };

  useEffect(() => {
    if (triggerStatus?.warning_sent && !shownWarningAlertRef.current) {
      shownWarningAlertRef.current = true;
      setAutoMessage("warning", "Warning email sent to the account owner at the 15-second mark.");
    }
    if (!triggerStatus?.warning_sent) {
      shownWarningAlertRef.current = false;
    }
  }, [triggerStatus?.warning_sent]);

  useEffect(() => {
    if (triggerStatus?.is_triggered && !shownTriggeredAlertRef.current) {
      shownTriggeredAlertRef.current = true;
      setAutoMessage("trigger", "Emergency trigger executed automatically.");
      alert("Emergency trigger has been executed.");
    }
    if (!triggerStatus?.is_triggered) {
      shownTriggeredAlertRef.current = false;
    }
  }, [triggerStatus?.is_triggered]);

  async function handleCheckIn() {
    try {
      const data = await apiFetch("/check-in", { method: "POST" });
      setAutoMessage("checkIn", data.message);
      // Clear other messages immediately on check-in
      setMessages((prev) => ({ ...prev, trigger: "", warning: "" }));
      setUser((prev) => ({ ...prev, last_check_in: data.last_check_in, is_triggered: false, warning_sent: false }));
    } catch (error) {
      setAutoMessage("checkIn", error.message);
    }
  }

  async function handleTrigger() {
    setSending(true);
    try {
      const data = await apiFetch("/trigger/simulate", { method: "POST" });
      setAutoMessage("trigger", data.message);
      setUser((prev) => ({ ...prev, is_triggered: true }));
    } catch (error) {
      setAutoMessage("trigger", error.message);
    } finally {
      setSending(false);
    }
  }

  const countdown = triggerStatus ? triggerStatus.seconds_until_trigger : null;
  const progress = triggerStatus
    ? Math.min(100, Math.round((triggerStatus.seconds_since_check_in / triggerStatus.threshold_seconds) * 100))
    : 0;

  return (
    <>
      <SectionHeader
        title="Safety Trigger"
        description="Based On your inactivity, your datas will be sent to your trusted contacts once the trigger is pulled"
      />

      <div className="trigger-page-grid enhanced-trigger-grid bg-white w-full">
        <div className="card trigger-timer-card glow-card">
          <span className="eyebrow warm">Live timer</span>
          <div className="timer-hero">{countdown !== null ? `${countdown}s` : "--"}</div>
          <p className="muted">Remaining before the inactivity trigger fires automatically.</p>
          <div className="progress-shell">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="row-between top-gap wrap-mobile">
            <span className="pill-muted">Warning: {triggerStatus ? `${triggerStatus.warning_threshold_seconds}s` : "15s"}</span>
            <span className="pill-muted">Final trigger: {triggerStatus ? `${triggerStatus.threshold_seconds}s` : "30s"}</span>
            <span className="pill-muted">Records ready: {records.length}</span>
          </div>
        </div>
        <div className="card action-card trigger-actions-card">
          <h2>Quick actions</h2>
          <div className="no-gap-stack flex-1">
            <div className="action-group">
              <button onClick={handleCheckIn}>
                <span className="btn-icon">🛡️</span>
                I am safe — check in now
              </button>
              {messages.checkIn ? <div className="notice success slim vanish-notice">{messages.checkIn}</div> : null}
              {messages.warning ? <div className="notice slim vanish-notice">{messages.warning}</div> : null}
            </div>

            <div className="action-group">
              <button className="danger" onClick={handleTrigger} disabled={sending}>
                <span className="btn-icon">🚨</span>
                {sending ? "Processing..." : "Send emergency release now"}
              </button>
              {messages.trigger ? <div className="notice warning slim vanish-notice">{messages.trigger}</div> : null}
            </div>
          </div>
        </div>
      </div>
      <div className="card trigger-status-card">
        <h2>Trigger status</h2>
        <div className="list">
          <div className="item row-between"><span>Last check-in</span><strong>{triggerStatus?.last_check_in_display || formatServerDate(user.last_check_in)}</strong></div>
          <div className="item row-between"><span>Server time</span><strong>{triggerStatus?.server_time_display || "Loading..."}</strong></div>
          <div className="item row-between"><span>Seconds since check-in</span><strong>{triggerStatus ? triggerStatus.seconds_since_check_in : "--"}</strong></div>
          <div className="item row-between"><span>Warning mail state</span><strong>{triggerStatus?.warning_sent ? "Sent" : `${triggerStatus?.seconds_until_warning ?? '--'}s left`}</strong></div>
          <div className="item row-between"><span>Final trigger state</span><strong>{user.is_triggered ? "Triggered" : "Monitoring"}</strong></div>
          <div className="item row-between"><span>Contacts available</span><strong>{contacts.length}</strong></div>
        </div>
      </div>

    </>
  );
}
