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
      setSaveStatus("Saved. This will go with your list.");
      if (setUser) setUser({ ...user, last_message: lastMessage });
    } catch {
      setSaveStatus("Sorry, that did not save. Please try again.");
    }
    setTimeout(() => setSaveStatus(""), 4000);
  }

  return (
    <>
      <SectionHeader
        title="My account"
        description="Your details, what your list adds up to, and the message that would go with it."
      />

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2>Your details</h2>
              <p>How you sign in.</p>
            </div>
          </div>
          <div className="list">
            <div className="item row-between"><span>Name</span><strong>{user.name}</strong></div>
            <div className="item row-between"><span>Email</span><strong className="small">{user.email}</strong></div>
            <div className="item row-between"><span>You last checked in</span><strong className="small">{formatServerDate(user.last_check_in)}</strong></div>
            <div className="item row-between">
              <span>Have we warned you?</span>
              <strong>{triggerStatus?.warning_sent ? "Yes" : "No"}</strong>
            </div>
            <div className="item row-between">
              <span>Safety check</span>
              <strong>{user.is_triggered ? "Already sent" : triggerStatus?.is_timer_active ? "On" : "Off"}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2>What it all adds up to</h2>
              <p>Across the {records.length} things you have listed.</p>
            </div>
            <span className="badge">Worth {formatCurrency(portfolio.netWorth)}</span>
          </div>

          <div className="summary-grid">
            <div className="summary-tile">
              <span>You own</span>
              <strong className="figure is-asset">{formatCurrency(portfolio.assets)}</strong>
            </div>
            <div className="summary-tile">
              <span>You owe</span>
              <strong className="figure is-debt">{formatCurrency(portfolio.liabilities)}</strong>
            </div>
            <div className="summary-tile">
              <span>Owed to you</span>
              <strong className="figure is-lent">{formatCurrency(portfolio.totals.receivable)}</strong>
            </div>
          </div>

          <div className="list top-gap">
            <div className="item row-between"><span>Things on your list</span><strong>{records.length}</strong></div>
            <div className="item row-between"><span>People you trust</span><strong>{contacts.length}</strong></div>
            <div className="item row-between"><span>Insurance listed</span><strong>{formatCurrency(portfolio.protection)}</strong></div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Your message to them</h2>
            <p>
              Your list tells them what you had. This tells them what you meant. It goes at the top of what they
              are sent. Write it however you like.
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
          <button onClick={handleSaveLastMessage}>Save this</button>
          {saveStatus ? <div className="notice success">{saveStatus}</div> : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <h2>Who would get it</h2>
            <p>Everyone you have named so far.</p>
          </div>
        </div>
        {contacts.length === 0 ? (
          <div className="empty-state">
            <strong>Nobody yet</strong>
            Until you name someone, none of this would reach anyone.
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
