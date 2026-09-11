import { useEffect, useRef, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import { formatServerDate, formatDuration, formatThreshold } from "../../storage";
import "./TriggerPage.css";

export default function TriggerPage({ user, setUser, records, contacts, triggerStatus, refreshStatus }) {
  const [messages, setMessages] = useState({ checkIn: "", trigger: "", warning: "" });
  const [sending, setSending] = useState(false);
  const [armConfirm, setArmConfirm] = useState(false);
  const shownTriggeredAlertRef = useRef(false);
  const shownWarningAlertRef = useRef(false);

  const setAutoMessage = (key, text) => {
    setMessages((prev) => ({ ...prev, [key]: text }));
    setTimeout(() => setMessages((prev) => ({ ...prev, [key]: "" })), 5000);
  };

  useEffect(() => {
    if (!triggerStatus || user.is_triggered || !triggerStatus.is_timer_active) return;

    const warningLimit = triggerStatus.warning_threshold_seconds || 15;
    const currentCountdown = triggerStatus.seconds_until_trigger;

    if (currentCountdown <= warningLimit && currentCountdown > 0 && !shownWarningAlertRef.current) {
      shownWarningAlertRef.current = true;
      setAutoMessage("warning", "Inactivity detected. A warning has been sent to you.");
    }

    if (currentCountdown <= 0 && !shownTriggeredAlertRef.current) {
      shownTriggeredAlertRef.current = true;
      setAutoMessage("trigger", "Release executed. Your trusted circle has been notified.");
    }

    if (currentCountdown > warningLimit) {
      shownWarningAlertRef.current = false;
      shownTriggeredAlertRef.current = false;
    }
  }, [triggerStatus?.seconds_until_trigger, user.is_triggered, triggerStatus?.is_timer_active, triggerStatus?.warning_threshold_seconds]);

  async function handleCheckIn() {
    try {
      const data = await apiFetch("/check-in", { method: "POST" });
      setAutoMessage("checkIn", data.message);
      setMessages((prev) => ({ ...prev, trigger: "", warning: "" }));
      setUser((prev) => ({ ...prev, last_check_in: data.last_check_in, is_triggered: false, warning_sent: false }));
      if (typeof refreshStatus === "function") refreshStatus();
    } catch (error) {
      setAutoMessage("checkIn", error.message);
    }
  }

  async function handleTrigger() {
    setSending(true);
    setArmConfirm(false);
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

  const expired = triggerStatus?.is_timer_active
    && !triggerStatus?.is_triggered
    && triggerStatus?.seconds_until_trigger <= 0;

  const state = triggerStatus?.is_triggered
    ? { tone: "critical", label: "Released" }
    : expired
      ? { tone: "warning", label: "Releasing now" }
      : triggerStatus?.is_timer_active
        ? { tone: "good", label: "Armed and watching" }
        : { tone: "warning", label: "Not armed" };

  return (
    <>
      <SectionHeader
        eyebrow="The watch"
        title="Safety trigger"
        description="A clock that resets every time you check in. If it ever runs out, your records go to your trusted circle — no claim, no paperwork, no waiting."
        action={<span className={`badge ${state.tone}`}>{state.label}</span>}
      />

      <div className="trigger-grid">
        <div className="card card-ledger trigger-clock">
          <span className="eyebrow">Time remaining</span>
          <div className="timer-hero">
            {triggerStatus?.is_triggered
              ? "Released"
              : expired
                ? "Time up"
                : !triggerStatus?.is_timer_active
                  ? "Not armed"
                  : triggerStatus?.seconds_until_trigger !== undefined
                    ? formatDuration(triggerStatus.seconds_until_trigger)
                    : "—"}
          </div>
          <p className="muted small">
            {triggerStatus?.is_triggered
              ? "The release has already gone out. Check in to reset the system."
              : expired
                ? "The clock has run out. The release is going out now — check in if this is a mistake."
                : !triggerStatus?.is_timer_active
                  ? "Check in once and the watch begins."
                  : "Until the release goes out automatically."}
          </p>

          <div className="progress-shell top-gap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <div className="trigger-marks">
            <span className="pill-muted">Warning at {triggerStatus ? formatThreshold(triggerStatus.warning_threshold_seconds) : "—"}</span>
            <span className="pill-muted">Release at {triggerStatus ? formatThreshold(triggerStatus.threshold_seconds) : "—"}</span>
            <span className="pill-muted">{records.length} records ready</span>
            <span className="pill-muted">{contacts.length} contacts</span>
          </div>
        </div>

        <div className="card trigger-actions">
          <h2>Actions</h2>

          <div className="trigger-action">
            <button className="full-width" onClick={handleCheckIn}>I am safe — check in</button>
            <p className="muted tiny">Resets the clock and, if the watch is off, starts it.</p>
            {messages.checkIn ? <div className="notice success">{messages.checkIn}</div> : null}
            {messages.warning ? <div className="notice warning">{messages.warning}</div> : null}
          </div>

          <div className="trigger-action">
            {armConfirm ? (
              <div className="confirm-box">
                <p>
                  This sends your full record to all {contacts.length} trusted contact
                  {contacts.length === 1 ? "" : "s"} immediately. It cannot be recalled.
                </p>
                <div className="action-row">
                  <button className="danger" onClick={handleTrigger} disabled={sending}>
                    {sending ? "Sending…" : "Yes, release now"}
                  </button>
                  <button className="secondary" onClick={() => setArmConfirm(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="danger full-width" onClick={() => setArmConfirm(true)} disabled={sending || contacts.length === 0}>
                Release everything now
              </button>
            )}
            <p className="muted tiny">
              {contacts.length === 0
                ? "Add a trusted contact before this can be used."
                : "For a genuine emergency, or to test the delivery."}
            </p>
            {messages.trigger ? <div className="notice critical">{messages.trigger}</div> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Watch status</h2>
            <p>What the server currently holds for your account.</p>
          </div>
        </div>
        <div className="grid-2">
          <div className="list">
            <div className="item row-between"><span>Last check-in</span><strong className="small">{triggerStatus?.last_check_in_display || formatServerDate(user.last_check_in)}</strong></div>
            <div className="item row-between"><span>Server time</span><strong className="small">{triggerStatus?.server_time_display || "—"}</strong></div>
            <div className="item row-between"><span>Silent for</span><strong>{triggerStatus && triggerStatus.seconds_since_check_in !== null ? formatDuration(triggerStatus.seconds_since_check_in) : "—"}</strong></div>
          </div>
          <div className="list">
            <div className="item row-between"><span>Warning notice</span><strong>{triggerStatus?.warning_sent ? "Sent" : triggerStatus?.seconds_until_warning !== undefined ? `${formatDuration(triggerStatus.seconds_until_warning)} away` : "—"}</strong></div>
            <div className="item row-between"><span>Release state</span><strong>{user.is_triggered ? "Released" : "Monitoring"}</strong></div>
            <div className="item row-between"><span>Contacts on file</span><strong>{contacts.length}</strong></div>
          </div>
        </div>
      </div>
    </>
  );
}
