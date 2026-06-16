import { useEffect, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import { formatServerDate, formatDuration, formatThreshold } from "../../storage";
import "./TriggerPage.css";

export default function TriggerPage({ user, setUser, records, contacts, triggerStatus, refreshStatus }) {
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

  // Instant notifications based on global countdown
  useEffect(() => {
    if (!triggerStatus || user.is_triggered || !triggerStatus.is_timer_active) return;

    const warningLimit = triggerStatus.warning_threshold_seconds || 15;
    const currentCountdown = triggerStatus.seconds_until_trigger;

    // Warning Alert
    if (currentCountdown <= warningLimit && currentCountdown > 0 && !shownWarningAlertRef.current) {
      shownWarningAlertRef.current = true;
      setAutoMessage("warning", "⚠️ Warning: Inactivity detected. Emergency protocols initiated.");
    }

    // Trigger Alert
    if (currentCountdown <= 0 && !shownTriggeredAlertRef.current) {
      shownTriggeredAlertRef.current = true;
      setAutoMessage("trigger", "🚨 Emergency trigger executed. Notifications sent to contacts.");
    }

    // Reset refs if we check in (countdown goes back up)
    if (currentCountdown > warningLimit) {
      shownWarningAlertRef.current = false;
      shownTriggeredAlertRef.current = false;
    }
  }, [triggerStatus?.seconds_until_trigger, user.is_triggered, triggerStatus?.is_timer_active, triggerStatus?.warning_threshold_seconds]);

  async function handleCheckIn() {
    try {
      const data = await apiFetch("/check-in", { method: "POST" });
      setAutoMessage("checkIn", data.message);
      // Clear other messages immediately on check-in
      setMessages((prev) => ({ ...prev, trigger: "", warning: "" }));
      setUser((prev) => ({ ...prev, last_check_in: data.last_check_in, is_triggered: false, warning_sent: false }));

      // FORCE REFRESH: Sync with server ground truth immediately
      if (typeof refreshStatus === "function") {
        refreshStatus();
      }
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



  const progress = triggerStatus && triggerStatus.seconds_since_check_in !== null
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
          <div className="timer-hero">
            {triggerStatus?.is_triggered 
              ? "TIME OUT" 
              : !triggerStatus?.is_timer_active 
                ? "--" 
                : triggerStatus?.seconds_until_trigger !== undefined ? formatDuration(triggerStatus.seconds_until_trigger) : "--"}
          </div>
          <p className="muted">
            {triggerStatus?.is_triggered 
              ? "Trigger has been pulled. Click 'Check in now' to reset the system."
              : !triggerStatus?.is_timer_active 
                ? "Click 'Check in now' to activate the safety trigger timer." 
                : "Remaining before the inactivity trigger fires automatically."}
          </p>
          <div className="progress-shell">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <div className="row-between top-gap wrap-mobile">
            <span className="pill-muted">Warning: {triggerStatus ? formatThreshold(triggerStatus.warning_threshold_seconds) : "2 months"}</span>
            <span className="pill-muted">Final trigger: {triggerStatus ? formatThreshold(triggerStatus.threshold_seconds) : "3 months"}</span>
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
          <div className="item row-between"><span>Inactivity duration</span><strong>{triggerStatus && triggerStatus.seconds_since_check_in !== null ? formatDuration(triggerStatus.seconds_since_check_in) : "--"}</strong></div>
          <div className="item row-between"><span>Warning mail state</span><strong>{triggerStatus?.warning_sent ? "Sent" : triggerStatus?.seconds_until_warning !== undefined ? `${formatDuration(triggerStatus.seconds_until_warning)} left` : "--"}</strong></div>
          <div className="item row-between"><span>Final trigger state</span><strong>{user.is_triggered ? "Triggered" : "Monitoring"}</strong></div>
          <div className="item row-between"><span>Contacts available</span><strong>{contacts.length}</strong></div>
        </div>
      </div>

    </>
  );
}
