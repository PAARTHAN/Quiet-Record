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
    ? { label: "Unreachable", tone: "critical", note: "Nothing will be released — there is nobody to release it to." }
    : contacts.length < 2
      ? { label: "Single point of failure", tone: "warning", note: "One contact means one thing has to go right. Add a second." }
      : { label: "Ready", tone: "good", note: "Enough people to make the release reliable." };

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
        eyebrow="The trusted circle"
        title="Trusted contacts"
        description="The people who receive your legacy report if you become unreachable. They see nothing until that moment."
        action={<span className={`badge ${readiness.tone}`}>{readiness.label}</span>}
      />

      <div className="notice contacts-readiness">{readiness.note}</div>

      <div className="split-form">
        <form className="card contact-form" onSubmit={handleSubmit}>
          <div className="section-header compact">
            <div>
              <h1>{editingId ? "Edit contact" : "Add a contact"}</h1>
              <p>Someone who would act on your behalf.</p>
            </div>
          </div>

          <div className="form-grid top-gap">
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" placeholder="e.g. Anita Rao" value={form.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, "") })}
                     pattern="[A-Za-z ]+" title="Letters and spaces only" required />
            </div>

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" placeholder="anita@example.com" value={form.email}
                     onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>

            <div className="field">
              <label htmlFor="phone">Phone, with country code</label>
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
              <span className="hint">The release goes out by SMS as well as email.</span>
            </div>

            <div className="field">
              <label htmlFor="relationship">Relationship</label>
              <input id="relationship" placeholder="Sister, solicitor, friend…" value={form.relationship}
                     onChange={(e) => setForm({ ...form, relationship: e.target.value.replace(/[^a-zA-Z ]/g, "") })}
                     maxLength="40" />
            </div>

            <div className="action-row">
              <button type="submit">{editingId ? "Save changes" : "Add contact"}</button>
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
                <h2>Your circle</h2>
                <p>{contacts.length} {contacts.length === 1 ? "person" : "people"} registered.</p>
              </div>
            </div>

            {contacts.length === 0 ? (
              <div className="empty-state">
                <strong>No one is listed</strong>
                Add at least two people so a single unreachable contact does not break the chain.
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
            <h2>How the release works</h2>
            <ol className="how-list">
              <li>
                <strong>Nothing is shared while you check in.</strong> Your contacts are stored, but they are told
                nothing and can see nothing.
              </li>
              <li>
                <strong>A warning goes to you first.</strong> If you fall silent, you get a warning before anything
                is sent to anyone else.
              </li>
              <li>
                <strong>Then the report goes out.</strong> Each contact receives a secure link by SMS and email to
                your records, your final message, and the counterparties they will need to reach.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
