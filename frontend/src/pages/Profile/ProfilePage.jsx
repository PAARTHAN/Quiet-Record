import { useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import { formatCurrency, formatServerDate } from "../../storage";
import { buildPortfolio } from "../../advisor";
import "./ProfilePage.css";

export default function ProfilePage({ user, records, contacts, triggerStatus, setUser }) {
  const portfolio = buildPortfolio(records);
  const [lastMessage, setLastMessage] = useState(user?.last_message || "");
  const [saveStatus, setSaveStatus] = useState("");

  async function handleSaveLastMessage() {
    try {
      await apiFetch("/users/me/last-message", {
        method: "PUT",
        body: JSON.stringify({ last_message: lastMessage }),
      });
      setSaveStatus("Saved. This travels with your report.");
      if (setUser) setUser({ ...user, last_message: lastMessage });
    } catch {
      setSaveStatus("Could not save the message.");
    }
    setTimeout(() => setSaveStatus(""), 4000);
  }

  return (
    <>
      <SectionHeader
        eyebrow="Your account"
        title="Profile"
        description="Who you are on this record, what it holds in total, and the message that goes with it."
      />

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Account</h2>
              <p>Held on the server against your login.</p>
            </div>
          </div>
          <div className="list">
            <div className="item row-between"><span>Name</span><strong>{user.name}</strong></div>
            <div className="item row-between"><span>Email</span><strong className="small">{user.email}</strong></div>
            <div className="item row-between"><span>Last check-in</span><strong className="small">{formatServerDate(user.last_check_in)}</strong></div>
            <div className="item row-between">
              <span>Warning notice</span>
              <strong>{triggerStatus?.warning_sent ? "Sent" : "Not sent"}</strong>
            </div>
            <div className="item row-between">
              <span>Watch state</span>
              <strong>{user.is_triggered ? "Released" : triggerStatus?.is_timer_active ? "Armed" : "Not armed"}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>What the record holds</h2>
              <p>Totals across {records.length} entries.</p>
            </div>
            <span className="badge">{formatCurrency(portfolio.netWorth)} net</span>
          </div>

          <div className="summary-grid">
            <div className="summary-tile">
              <span>Assets</span>
              <strong className="figure is-asset">{formatCurrency(portfolio.assets)}</strong>
            </div>
            <div className="summary-tile">
              <span>Liabilities</span>
              <strong className="figure is-debt">{formatCurrency(portfolio.liabilities)}</strong>
            </div>
            <div className="summary-tile">
              <span>Owed to you</span>
              <strong className="figure is-lent">{formatCurrency(portfolio.totals.receivable)}</strong>
            </div>
          </div>

          <div className="list top-gap">
            <div className="item row-between"><span>Records in the vault</span><strong>{records.length}</strong></div>
            <div className="item row-between"><span>Trusted contacts</span><strong>{contacts.length}</strong></div>
            <div className="item row-between"><span>Insurance recorded</span><strong>{formatCurrency(portfolio.protection)}</strong></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Your final message</h2>
            <p>
              The records say what you owned. This says what you meant. It appears at the top of the report your
              trusted contacts receive.
            </p>
          </div>
        </div>
        <textarea
          className="final-message"
          value={lastMessage}
          onChange={(e) => setLastMessage(e.target.value)}
          placeholder="If you are reading this, something has happened to me. Here is what I want you to know…"
          rows="8"
        />
        <div className="action-row top-gap">
          <button onClick={handleSaveLastMessage}>Save message</button>
          {saveStatus ? <div className="notice success">{saveStatus}</div> : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Who receives it</h2>
            <p>Everyone currently in your trusted circle.</p>
          </div>
        </div>
        {contacts.length === 0 ? (
          <div className="empty-state">
            <strong>Nobody yet</strong>
            Without a contact, nothing is released to anyone.
          </div>
        ) : (
          <div className="recipient-grid">
            {contacts.map((contact) => (
              <div className="recipient" key={contact.id}>
                <strong>{contact.name}</strong>
                <div className="muted tiny">{contact.relationship_name || "Recipient"}</div>
                <div className="tiny top-gap">{contact.email}</div>
                <div className="muted tiny">{contact.phone || "No phone recorded"}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
