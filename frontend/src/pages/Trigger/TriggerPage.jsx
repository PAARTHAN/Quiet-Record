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
      setAutoMessage("warning", "You have been quiet for a while, so we have emailed you a warning.");
    }

    if (currentCountdown <= 0 && !shownTriggeredAlertRef.current) {
      shownTriggeredAlertRef.current = true;
      setAutoMessage("trigger", "The clock ran out. Your list has been sent to the people you trust.");
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
    ? { tone: "critical", label: "Your list has been sent" }
    : expired
      ? { tone: "warning", label: "Sending now" }
      : triggerStatus?.is_timer_active
        ? { tone: "good", label: "On and counting" }
        : { tone: "warning", label: "Switched off" };

  return (
    <>
      <SectionHeader
        title="Safety check"
        description="A clock that starts again every time you press the button. If it ever runs all the way down, your list is sent to the people you trust — no forms, no waiting, no one having to prove anything."
        action={<span className={`badge ${state.tone}`}>{state.label}</span>}
      />

      <div className="trigger-grid">
        <div className="card card-ledger trigger-clock">
          <span className="eyebrow">Time left</span>
          <div className="timer-hero">
            {triggerStatus?.is_triggered
              ? "Sent"
              : expired
                ? "Time up"
                : !triggerStatus?.is_timer_active
                  ? "Off"
                  : triggerStatus?.seconds_until_trigger !== undefined
                    ? formatDuration(triggerStatus.seconds_until_trigger)
                    : "—"}
          </div>
          <p className="muted small">
            {triggerStatus?.is_triggered
              ? "Your list has already gone out. Press the button to start again."
              : expired
                ? "The clock ran out and your list is being sent. If that is a mistake, press the button now."
                : !triggerStatus?.is_timer_active
                  ? "Press the button below once and the clock starts."
                  : "Left before your list is sent on its own."}
          </p>

          <div className="progress-shell top-gap">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>

          <div className="trigger-marks">
            <span className="pill-muted">We warn you after {triggerStatus ? formatThreshold(triggerStatus.warning_threshold_seconds) : "—"}</span>
            <span className="pill-muted">We send it after {triggerStatus ? formatThreshold(triggerStatus.threshold_seconds) : "—"}</span>
            <span className="pill-muted">{records.length} things listed</span>
            <span className="pill-muted">{contacts.length} people</span>
          </div>
        </div>

        <div className="card trigger-actions">
          <h2>What you can do</h2>

          <div className="trigger-action">
            <button className="full-width" onClick={handleCheckIn}>I am fine — start the clock again</button>
            <p className="muted small">Press this now and then. It puts the clock back to the beginning.</p>
            {messages.checkIn ? <div className="notice success">{messages.checkIn}</div> : null}
            {messages.warning ? <div className="notice warning">{messages.warning}</div> : null}
          </div>

          <div className="trigger-action">
            {armConfirm ? (
              <div className="confirm-box">
                <p>
                  This sends your whole list to {contacts.length === 1 ? "the person" : `all ${contacts.length} people`} you
                  trust, right now. You cannot take it back.
                </p>
                <div className="action-row">
                  <button className="danger" onClick={handleTrigger} disabled={sending}>
                    {sending ? "Sending…" : "Yes, send it now"}
                  </button>
                  <button className="secondary" onClick={() => setArmConfirm(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="danger full-width" onClick={() => setArmConfirm(true)} disabled={sending || contacts.length === 0}>
                Send everything now
              </button>
            )}
            <p className="muted tiny">
              {contacts.length === 0
                ? "Add someone you trust before you can use this."
                : "For a real emergency, or to check that it works."}
            </p>
            {messages.trigger ? <div className="notice critical">{messages.trigger}</div> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Where things stand</h2>
            <p>The details, if you want them.</p>
          </div>
        </div>
        <div className="grid-2">
          <div className="list">
            <div className="item row-between"><span>You last pressed the button</span><strong className="small">{triggerStatus?.last_check_in_display || formatServerDate(user.last_check_in)}</strong></div>
            <div className="item row-between"><span>Time right now</span><strong className="small">{triggerStatus?.server_time_display || "—"}</strong></div>
            <div className="item row-between"><span>Quiet for</span><strong>{triggerStatus && triggerStatus.seconds_since_check_in !== null ? formatDuration(triggerStatus.seconds_since_check_in) : "—"}</strong></div>
          </div>
          <div className="list">
            <div className="item row-between"><span>We warn you in</span><strong>{triggerStatus?.warning_sent ? "Sent" : triggerStatus?.seconds_until_warning !== undefined ? `${formatDuration(triggerStatus.seconds_until_warning)} away` : "—"}</strong></div>
            <div className="item row-between"><span>Has it been sent?</span><strong>{user.is_triggered ? "Yes, sent" : "No, all quiet"}</strong></div>
            <div className="item row-between"><span>People who would be told</span><strong>{contacts.length}</strong></div>
          </div>
        </div>
      </div>
    </>
  );
}
