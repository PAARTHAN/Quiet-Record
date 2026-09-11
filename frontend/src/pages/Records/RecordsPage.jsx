import { useMemo, useState } from "react";
import SectionHeader from "../../components/SectionHeader/SectionHeader";
import { apiFetch } from "../../api";
import { formatCurrency } from "../../storage";
import { ASSET_CLASSES, classifyRecord, parseRate } from "../../advisor";
import "./RecordsPage.css";

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

const BUCKET_LABELS = {
  liability: "Liability",
  protection: "Protection",
  note: "Note",
};

const emptyRecord = { category: "Debt", title: "", amount: "", details: "", owner: "" };

export default function RecordsPage({ records, loadRecords }) {
  const [form, setForm] = useState(emptyRecord);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState(null);

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((item) =>
      [item.category, item.title, item.owner, item.details].join(" ").toLowerCase().includes(term),
    );
  }, [records, search]);

  const total = useMemo(
    () => filteredRecords.reduce((sum, item) => sum + (Number.parseFloat(item.amount) || 0), 0),
    [filteredRecords],
  );

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
        await apiFetch("/records", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Record added.");
      }
      await loadRecords();
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
    setConfirmId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    try {
      await apiFetch(`/records/${id}`, { method: "DELETE" });
      await loadRecords();
      setMessage("Record deleted.");
      setConfirmId(null);
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
        eyebrow="The vault"
        title="Records"
        description="Everything you own and owe, entered once. The advisor reads this ledger, and so will your trusted circle."
        action={<span className="pill-muted">{records.length} entries</span>}
      />

      <div className="split-form">
        <form className="card record-form" onSubmit={handleSubmit}>
          <div className="section-header compact">
            <div>
              <h1>{editingId ? "Edit record" : "New record"}</h1>
              <p>Stored against your account only.</p>
            </div>
          </div>

          <div className="form-grid top-gap">
            <div className="field">
              <label htmlFor="category">Category</label>
              <select id="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" placeholder="e.g. HDFC home loan" value={form.title}
                     onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength="80" required />
            </div>

            <div className="two-col">
              <div className="field field-prefixed">
                <label htmlFor="amount">Amount</label>
                <input id="amount" inputMode="decimal" placeholder="0" value={form.amount}
                       onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} />
              </div>
              <div className="field">
                <label htmlFor="owner">Person / company</label>
                <input id="owner" placeholder="Counterparty" value={form.owner}
                       onChange={(e) => setForm({ ...form, owner: e.target.value })} maxLength="60" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="details">Details</label>
              <textarea id="details" placeholder="Account numbers, contacts, where the paperwork lives…"
                        value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
              <span className="hint">
                Two things the advisor reads from this box: an interest rate — “@ 10.5%” — puts a debt in the right
                payoff order, and “self-occupied” on a property marks it as the home you live in, so it counts towards
                your net worth but is left out of the rebalancing advice.
              </span>
            </div>

            <div className="action-row">
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Add record"}
              </button>
              <button type="button" className="secondary" onClick={resetForm}>
                {editingId ? "Cancel" : "Clear"}
              </button>
            </div>

            {message ? <div className="notice">{message}</div> : null}
          </div>
        </form>

        <div className="card">
          <div className="card-head wrap">
            <div>
              <h2>The ledger</h2>
              <p>
                {filteredRecords.length} of {records.length} shown · {formatCurrency(total)} is the raw sum of the amounts listed, assets and debts alike
              </p>
            </div>
            <input
              className="record-search"
              placeholder="Search titles, people, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filteredRecords.length === 0 ? (
            <div className="empty-state">
              <strong>{records.length === 0 ? "Nothing recorded yet" : "No matches"}</strong>
              {records.length === 0
                ? "Start with your bank balance, then work outwards to loans, policies and investments."
                : "Try a different search term."}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="ledger-table records-table">
                <thead>
                  <tr>
                    <th>Entry</th>
                    <th>Category</th>
                    <th>Counterparty</th>
                    <th className="num">Amount</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((item) => {
                    const bucket = classifyRecord(item);
                    const rate = parseRate(item);
                    const bucketLabel = BUCKET_LABELS[bucket] || ASSET_CLASSES[bucket]?.label || "Other";
                    return (
                      <tr key={item.id} className={editingId === item.id ? "is-editing" : ""}>
                        <td>
                          <strong>{item.title}</strong>
                          {item.details ? <div className="muted tiny record-details">{item.details}</div> : null}
                        </td>
                        <td>
                          <span className={`badge ${bucket === "liability" ? "critical" : "plain"}`}>
                            {item.category || "Other"}
                          </span>
                          <div className="muted tiny">counted as {bucketLabel.toLowerCase()}</div>
                        </td>
                        <td className="muted">{item.owner || "—"}</td>
                        <td className="num">
                          {formatCurrency(item.amount)}
                          {rate !== null ? <div className="muted tiny">{rate}% rate</div> : null}
                        </td>
                        <td className="record-actions">
                          {confirmId === item.id ? (
                            <>
                              <button className="link-btn danger" onClick={() => handleDelete(item.id)}>Confirm</button>
                              <button className="link-btn" onClick={() => setConfirmId(null)}>Keep</button>
                            </>
                          ) : (
                            <>
                              <button className="link-btn" onClick={() => handleEdit(item)}>Edit</button>
                              <button className="link-btn danger" onClick={() => setConfirmId(item.id)}>Delete</button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
