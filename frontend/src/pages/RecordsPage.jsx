import { useMemo, useState } from "react";
import SectionHeader from "../components/SectionHeader";
import { apiFetch } from "../api";
import { formatCurrency } from "../storage";

const categoryOptions = [
  "Debt",
  "Money Owed To Me",
  "Insurance",
  "Stock",
  "Bond",
  "Bill",
  "Property",
  "Note",
  "Other",
];

const emptyRecord = {
  category: "Debt",
  title: "",
  amount: "",
  details: "",
  owner: "",
};

export default function RecordsPage({ user, records, loadRecords }) {
  const [form, setForm] = useState(emptyRecord);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((item) =>
      [item.category, item.title, item.owner, item.details]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [records, search]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    const payload = {
      ...form,
      category: form.category || "Other",
      title: form.title.trim(),
      amount: form.amount === "" ? "" : String(form.amount).trim(),
      details: form.details.trim(),
      owner: form.owner.trim(),
    };

    try {
      if (editingId) {
        await apiFetch(`/records/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Record updated.");
      } else {
        await apiFetch(`/records/${user.id}`, { method: "POST", body: JSON.stringify(payload) });
        setMessage("Record added.");
      }
      await loadRecords(user.id);
      setForm(emptyRecord);
      setEditingId(null);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setForm({
      category: item.category || "Other",
      title: item.title || "",
      amount: item.amount || "",
      details: item.details || "",
      owner: item.owner || "",
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/records/${id}`, { method: "DELETE" });
      await loadRecords(user.id);
      setMessage("Record deleted.");
      if (editingId === id) {
        setForm(emptyRecord);
        setEditingId(null);
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  function resetForm() {
    setForm(emptyRecord);
    setEditingId(null);
  }

  return (
    <>
      <SectionHeader
        title="Records"
        description="Add and manage debts, receivables, investments, and personal notes in one clean place."
      />

      <div className="content-grid records-grid enhanced-records-grid">
        <div className="card form-panel sticky-card record-form-card">
          <div className="section-header compact">
            <div>
              <h1>{editingId ? "Edit record" : "Add record"}</h1>
              <p>Each record is saved only for this account.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleSubmit}>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength="80" required />
            <div className="two-col">
              <input placeholder="Amount" inputMode="decimal" pattern="^\d*(\.\d{0,2})?$" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} />
              <input placeholder="Person / company" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} maxLength="60" />
            </div>
            <textarea placeholder="Details / notes / contact information" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
            <div className="action-row">
              <button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add record"}</button>
              <button type="button" className="secondary" onClick={resetForm}>Clear</button>
            </div>
          </form>
          {message ? <div className="notice slim top-gap">{message}</div> : null}
        </div>

        <div className="card list-panel records-list-card">
          <div className="section-header compact wrap-mobile">
            <div>
              <h1>All records</h1>
              <p>{records.length} saved record(s).</p>
            </div>
            <div className="records-tools">
              <input className="search-input" placeholder="Search records" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="record-grid enhanced-record-list-grid">
            {filteredRecords.length === 0 ? (
              <div className="item muted">No matching records found.</div>
            ) : (
              filteredRecords.map((item) => (
                <div className="item rich-item record-card-elevated" key={item.id}>
                  <div className="row-between align-start gap-12">
                    <div>
                      <strong>{item.title}</strong>
                      <div className="muted small-gap">{item.owner || "No counterparty"}</div>
                    </div>
                    <span className="badge gold">{item.category || "Other"}</span>
                  </div>
                  <div className="record-amount">{formatCurrency(item.amount || 0)}</div>
                  <p className="muted small-gap">{item.details || "No extra details"}</p>
                  <div className="action-row top-gap">
                    <button className="secondary" onClick={() => handleEdit(item)}>Edit</button>
                    <button className="danger" onClick={() => handleDelete(item.id)}>Delete</button>
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
