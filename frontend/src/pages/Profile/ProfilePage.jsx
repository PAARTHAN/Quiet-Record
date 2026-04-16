import { useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { calculateBuckets, currencyTotal, formatCurrency, formatServerDate } from "../../storage";
import { apiFetch } from "../../api";
import "./ProfilePage.css";

export default function ProfilePage({ user, records, contacts, triggerStatus, setUser }) {
  const buckets = calculateBuckets(records);
  const [lastMessage, setLastMessage] = useState(user?.last_message || "");
  const [saveStatus, setSaveStatus] = useState("");

  async function handleSaveLastMessage() {
    try {
      await apiFetch("/users/me/last-message", {
        method: "PUT",
        body: JSON.stringify({ last_message: lastMessage }),
      });
      setSaveStatus("Last message saved");
      if (setUser) {
        setUser({ ...user, last_message: lastMessage });
      }
    } catch {
      setSaveStatus("Could not save message");
    }
  }

  return (
    <>
      <SectionHeader
        title="Profile"
        description="Review your account, summary totals, trusted contacts, and your final message."
      />

      <div className="profile-shell-grid enhanced-profile-grid">
        <div className="card">
          <h2>Account details</h2>
          <div className="list">
            <div className="item row-between"><span>Name</span><strong>{user.name}</strong></div>
            <div className="item row-between"><span>Email</span><strong>{user.email}</strong></div>
            <div className="item row-between"><span>Last check-in</span><strong>{formatServerDate(user.last_check_in)}</strong></div>
            <div className="item row-between"><span>Warning mail</span><strong>{triggerStatus?.warning_sent ? "Sent" : `${triggerStatus?.seconds_until_warning ?? '--'}s left`}</strong></div>
            <div className="item row-between"><span>Final trigger</span><strong>{triggerStatus ? `${triggerStatus.seconds_until_trigger}s left` : "--"}</strong></div>
            <div className="item row-between"><span>Status</span><strong>{user.is_triggered ? "Triggered" : "Monitoring"}</strong></div>
          </div>
        </div>

        <div className="card flex-column">
          <div className="row-between section-spacer">
            <div>
              <h2>Financial summary</h2>
              <p className="muted">Overview of your documented ecosystem.</p>
            </div>
            <div className="badge gold">Total: {formatCurrency(currencyTotal(records))}</div>
          </div>

          <div className="triple-summary">
            <div className="mini-stat tint-debt">
              <span>Debt liabilities</span>
              <strong className="text-debt">{formatCurrency(buckets.debt)}</strong>
            </div>
            <div className="mini-stat tint-lent">
              <span>Expected inflows</span>
              <strong className="text-lent">{formatCurrency(buckets.lent)}</strong>
            </div>
            <div className="mini-stat tint-asset">
              <span>Retained assets</span>
              <strong className="text-asset">{formatCurrency(buckets.assets)}</strong>
            </div>
          </div>

          <div className="list flex-grow top-gap list-decor">
            <div className="item row-between outline-item">
              <div className="row-align gap-12">
                <span className="icon-circle">📂</span>
                <span>Total records in vault</span>
              </div>
              <strong className="emerald-text">{records.length} stored</strong>
            </div>
            <div className="item row-between outline-item">
              <div className="row-align gap-12">
                <span className="icon-circle">🛡️</span>
                <span>Trusted recipients</span>
              </div>
              <strong className="emerald-text">{contacts.length} verified</strong>
            </div>
          </div>
        </div>

        <div className="card full-span">
          <h2>Final message</h2>
          <p className="muted">
            This message will appear in the emergency report shared with your trusted contacts.
          </p>
          <textarea
            value={lastMessage}
            onChange={(e) => setLastMessage(e.target.value)}
            placeholder="If you're reading this, something has happened to me. Here is what I want you to know..."
            rows="7"
            className="message-box"
          />
          <div className="action-row top-gap">
            <button onClick={handleSaveLastMessage}>Save last message</button>
          </div>
          {saveStatus ? <div className="notice slim top-gap">{saveStatus}</div> : null}
        </div>

        <div className="card full-span">
          <h2>Trusted contacts</h2>
          <div className="contact-grid compact-grid">
            {contacts.length === 0 ? (
              <div className="item muted">No trusted contacts added yet.</div>
            ) : (
              contacts.map((contact) => (
                <div className="item" key={contact.id}>
                  <strong>{contact.name}</strong>
                  <div className="muted small-gap">{contact.relationship_name || "No relationship set"}</div>
                  <div className="small-gap">{contact.email}</div>
                  <div className="muted">{contact.phone || "No phone"}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
