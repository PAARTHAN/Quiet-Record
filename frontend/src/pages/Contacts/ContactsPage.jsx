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
        await apiFetch(`/contacts/${user.id}`, { method: "POST", body: JSON.stringify(form) });
        setMessage("Contact added.");
      }
      setForm(emptyContact);
      setEditingId(null);
      await loadContacts(user.id);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/contacts/${id}`, { method: "DELETE" });
      await loadContacts(user.id);
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

  return (
    <>
      <SectionHeader
        title="Trusted Contacts"
        description="Manage the people who should receive your emergency report."
      />

      <div className="content-grid contacts-grid">
        <div className="card form-panel sticky-card">
          <div className="section-header compact">
            <div>
              <h1>{editingId ? "Edit trusted contact" : "Add trusted contact"}</h1>
              <p>These contacts will receive the emergency release.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.replace(/[^a-zA-Z ]/g, "") })} pattern="[A-Za-z ]+" title="Use letters and spaces only" required />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <div className="two-col">
              <input placeholder="Phone" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} />
              <input placeholder="Relationship" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value.replace(/[^a-zA-Z ]/g, "") })} maxLength="40" />
            </div>
            <div className="action-row">
              <button type="submit">{editingId ? "Save changes" : "Add contact"}</button>
              <button type="button" className="secondary" onClick={resetForm}>Clear</button>
            </div>
          </form>
          {message ? <div className="notice slim top-gap">{message}</div> : null}
        </div>

        <div className="card list-panel">
          <div className="section-header compact">
            <div>
              <h1>Saved contacts</h1>
              <p>{contacts.length} trusted contact(s) added.</p>
            </div>
          </div>

          <div className="contact-grid">
            {contacts.length === 0 ? (
              <div className="item muted">No trusted contacts added yet.</div>
            ) : (
              contacts.map((contact) => (
                <div className="item rich-item" key={contact.id}>
                  <div className="row-between align-start gap-12">
                    <div>
                      <strong>{contact.name}</strong>
                      <div className="muted small-gap">{contact.relationship_name || "No relationship"}</div>
                    </div>
                    <span className="badge green">Trusted</span>
                  </div>
                  <div className="small-gap">{contact.email}</div>
                  <div className="muted small-gap">{contact.phone || "No phone number"}</div>
                  <div className="action-row top-gap">
                    <button className="secondary" onClick={() => startEdit(contact)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(contact.id)}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
