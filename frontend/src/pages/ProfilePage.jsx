import { useState } from "react";
import SectionHeader from "../components/SectionHeader";
import { calculateBuckets, formatCurrency, formatServerDate } from "../storage";
import { apiFetch } from "../api";

export default function ProfilePage({ user, records, contacts, triggerStatus, setUser }) {
  const buckets = calculateBuckets(records);
  const [lastMessage, setLastMessage] = useState(user?.last_message || "");
  const [saveStatus, setSaveStatus] = useState("");

  async function handleSaveLastMessage() {
    try {
      await apiFetch(`/users/${user.id}/last-message`, {
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

        <div className="card">
          <h2>Financial summary</h2>
          <div className="triple-summary">
            <div className="mini-stat"><span>Debt</span><strong>{formatCurrency(buckets.debt)}</strong></div>
            <div className="mini-stat"><span>Money owed to me</span><strong>{formatCurrency(buckets.lent)}</strong></div>
            <div className="mini-stat"><span>Assets</span><strong>{formatCurrency(buckets.assets)}</strong></div>
          </div>
          <div className="list top-gap">
            <div className="item row-between"><span>Total records</span><strong>{records.length}</strong></div>
            <div className="item row-between"><span>Trusted contacts</span><strong>{contacts.length}</strong></div>
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
