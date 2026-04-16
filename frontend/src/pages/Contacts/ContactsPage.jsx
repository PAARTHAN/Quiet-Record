import { useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import "./ContactsPage.css";

const emptyContact = { name: "", email: "", phone: "", relationship: "" };

export default function ContactsPage({ user, contacts, loadContacts }) {
  const [form, setForm] = useState(emptyContact);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");

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
      setMessage("Contact deleted.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startEdit(contact) {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || "",
      relationship: contact.relationship_name || "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyContact);
  }

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const readinessScore = contacts.length === 0 ? "Critical" : contacts.length < 3 ? "Caution" : "Optimal";
  const readinessColor = contacts.length === 0 ? "ruby" : contacts.length < 3 ? "topaz" : "emerald";

  return (
    <>
      <SectionHeader
        title="Trusted Contacts"
        description="Manage the people who should receive your emergency report."
      />

      <div className="content-grid contacts-dual-grid">
        <div className="card contact-form-box">
          <div className="section-header">
            <div>
              <h1>{editingId ? "Edit Trusted Contact" : "Add Trusted Contact"}</h1>
              <p>Register a person to receive your emergency data.</p>
            </div>
          </div>
          <form className="form-grid top-gap" onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Full Name</label>
              <input placeholder="Ex: John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, "") })} pattern="[A-Za-z ]+" title="Use letters and spaces only" required />
            </div>
            <div className="input-group">
              <label>Email Address</label>
              <input type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="two-col">
              <div className="input-group">
                <label>Phone (Optional)</label>
                <input placeholder="10 Digit Number" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
              </div>
              <div className="input-group">
                <label>Relationship</label>
                <input placeholder="Ex: Family / Friend" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value.replace(/[^a-zA-Z ]/g, "") })} maxLength="40" />
              </div>
            </div>
            <div className="action-row top-gap">
              <button type="submit" className="primary-btn">{editingId ? "Save Changes" : "Save Contact"}</button>
              <button type="button" className="secondary-btn" onClick={resetForm}>Clear</button>
            </div>
          </form>
          {message ? <div className="notice slim top-gap">{message}</div> : null}
        </div>

        <div className="card contact-list-box">
          <div className="section-header">
            <div>
              <h1>Added Trusted Contacts</h1>
              <p>{contacts.length} person(s) currently registered.</p>
            </div>
          </div>

          <div className="contact-small-grid auto-scroll">
            {contacts.length === 0 ? (
              <div className="empty-notice">No trusted contacts added yet.</div>
            ) : (
              contacts.map((contact) => (
                <div className="contact-row card" key={contact.id}>
                  <div className="contact-main">
                    <strong>{contact.name}</strong>
                    <span className="badge-pill">{contact.relationship_name || "Recipient"}</span>
                    <div className="muted small-font">{contact.email}</div>
                  </div>
                  <div className="contact-actions">
                    <button className="icon-link" onClick={() => startEdit(contact)}>Edit</button>
                    <button className="icon-link danger" onClick={() => handleDelete(contact.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="guidelines-section top-gap-large">
        <div className="section-header center">
          <h1>User Guidelines</h1>
          <p>How your trusted network is managed and secured.</p>
        </div>

        <div className="guidelines-bento">
          <div className="bento-card">
            <div className="bento-icon">🔒</div>
            <h3>Privacy First</h3>
            <p>Data is encrypted and inaccessible until the emergency trigger is confirmed.</p>
          </div>
          <div className="bento-card">
            <div className="bento-icon">🛡️</div>
            <h3>Verification</h3>
            <p>Contacts are notified only when you choose. They must verify identity to access files.</p>
          </div>
          <div className="bento-card">
            <div className="bento-icon">🚀</div>
            <h3>Auto-Delivery</h3>
            <p>Secure links are dispatched immediately after the inactivity threshold is reached.</p>
          </div>
        </div>
      </div>
    </>
  );
}
