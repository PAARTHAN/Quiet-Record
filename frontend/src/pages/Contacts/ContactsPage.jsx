import { useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import "./ContactsPage.css";

const emptyContact = { name: "", email: "", phone: "", relationship: "" };

function initials(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ContactsPage({ contacts, loadContacts }) {
  const [form, setForm] = useState(emptyContact);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState(null);

  const readiness = contacts.length === 0
    ? { label: "Nobody listed", tone: "critical", note: "Right now nothing would be sent to anyone, because you have not named a single person." }
    : contacts.length < 2
      ? { label: "Only one person", tone: "warning", note: "If this one person cannot be reached, nobody can. It is worth adding a second." }
      : { label: "All set", tone: "good", note: "Enough people that your list would reach someone." };

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    try {
      if (editingId) {
        await apiFetch(`/contacts/${editingId}`, { method: "PUT", body: JSON.stringify(form) });
        setMessage("Contact updated.");
      } else {
        await apiFetch("/contacts", { method: "POST", body: JSON.stringify(form) });
        setMessage("Contact added.");
      }
      setForm(emptyContact);
      setEditingId(null);
      await loadContacts();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      await loadContacts();
      setMessage("Contact removed.");
      setConfirmId(null);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(contact) {
    setEditingId(contact.id);
    setConfirmId(null);
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      relationship: contact.relationship_name || "",
    });
  }

  return (
    <>
      <SectionHeader
        title="People I trust"
        description="If something happens to you and you stop checking in, these are the people who would be sent your list. Until then they are told nothing at all."
        action={<span className={`badge ${readiness.tone}`}>{readiness.label}</span>}
      />

      <div className="notice contacts-readiness">{readiness.note}</div>

      <div className="split-form">
        <form className="card contact-form" onSubmit={handleSubmit}>
          <div className="section-header compact">
            <div>
              <h1>{editingId ? "Change this person" : "Add someone"}</h1>
              <p>Someone who would sort things out for you.</p>
            </div>
          </div>

          <div className="form-grid top-gap">
            <div className="field">
              <label htmlFor="name">Their name</label>
              <input id="name" placeholder="e.g. Anita Rao" value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, "") })}
                     pattern="[A-Za-z ]+" title="Letters and spaces only" required />
            </div>

            <div className="field">
              <label htmlFor="email">Their email</label>
              <input id="email" type="email" placeholder="anita@example.com" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>

            <div className="field">
              <label htmlFor="phone">Their phone number, with country code</label>
              <input
                id="phone"
                placeholder="+919876543210"
                inputMode="tel"
                pattern="\+[1-9]\d{1,3}\d{10}"
                title="Include + then the country code and number, e.g. +919876543210"
                value={form.phone}
                onChange={(e) => {
                  let value = e.target.value;
                  if (value.length > 0 && !value.startsWith("+")) value = `+${value}`;
                  const sanitized = value.startsWith("+")
                    ? `+${value.slice(1).replace(/\D/g, "")}`
                    : value.replace(/\D/g, "");
                  setForm({ ...form, phone: sanitized.slice(0, 15) });
                }}
                required
              />
              <span className="hint">They would get a text message as well as an email.</span>
            </div>

            <div className="field">
              <label htmlFor="relationship">Who are they to you?</label>
              <input id="relationship" placeholder="Sister, solicitor, friend…" value={form.relationship}
                     onChange={(e) => setForm({ ...form, relationship: e.target.value.replace(/[^a-zA-Z ]/g, "") })}
                     maxLength="40" />
            </div>

            <div className="action-row">
              <button type="submit">{editingId ? "Save" : "Add them"}</button>
              <button type="button" className="secondary" onClick={() => { setForm(emptyContact); setEditingId(null); }}>
                {editingId ? "Cancel" : "Clear"}
              </button>
            </div>

            {message ? <div className="notice">{message}</div> : null}
          </div>
        </form>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <div>
                <h2>The people you have named</h2>
                <p>{contacts.length} {contacts.length === 1 ? "person" : "people"} so far.</p>
              </div>
            </div>

            {contacts.length === 0 ? (
              <div className="empty-state">
                <strong>Nobody yet</strong>
                Add at least two people, so that if one cannot be reached the other still can.
              </div>
            ) : (
              <ul className="contact-list">
                {contacts.map((contact) => (
                  <li className="contact-row" key={contact.id}>
                    <span className="contact-avatar" aria-hidden="true">{initials(contact.name)}</span>
                    <div className="contact-main">
                      <div className="contact-name">
                        <strong>{contact.name}</strong>
                        <span className="badge plain">{contact.relationship_name || "Recipient"}</span>
                      </div>
                      <div className="muted tiny">{contact.email}</div>
                      <div className="muted tiny">{contact.phone || "No phone recorded"}</div>
                    </div>
                    <div className="contact-actions">
                      {confirmId === contact.id ? (
                        <>
                          <button className="link-btn danger" onClick={() => handleDelete(contact.id)}>Confirm</button>
                          <button className="link-btn" onClick={() => setConfirmId(null)}>Keep</button>
                        </>
                      ) : (
                        <>
                          <button className="link-btn" onClick={() => startEdit(contact)}>Edit</button>
                          <button className="link-btn danger" onClick={() => setConfirmId(contact.id)}>Remove</button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card card-sunk">
            <h2>What actually happens</h2>
            <ol className="how-list">
              <li>
                <strong>While you are around, nothing happens.</strong> These people are just names on a list.
                They are not contacted and cannot see anything.
              </li>
              <li>
                <strong>You get warned first.</strong> If you stop checking in, we email you before anybody else
                hears a thing.
              </li>
              <li>
                <strong>Only then is it sent.</strong> Each person gets a text and an email with your list, your
                message to them, and who they need to contact about each thing.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
