import { NavLink, useLocation } from "react-router-dom";

const icon = (paths) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
    {paths}
  </svg>
);

const links = [
  {
    to: "/",
    label: "Home",
    icon: icon(<><rect x="3" y="3" width="7" height="8" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="11" width="7" height="10" /><rect x="3" y="14" width="7" height="7" /></>),
  },
  {
    to: "/advisor",
    label: "What to do",
    icon: icon(<><path d="M3 17l5-6 4 4 4-6 5 5" /><path d="M3 21h18" /><circle cx="8" cy="11" r="1" /></>),
  },
  {
    to: "/records",
    label: "My money",
    icon: icon(<><path d="M5 3h11l3 3v15H5z" /><path d="M9 8h6M9 12h6M9 16h4" /></>),
  },
  {
    to: "/contacts",
    label: "People I trust",
    icon: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="3.5" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.6a4 4 0 0 1 0 7.75" /></>),
  },
  {
    to: "/trigger",
    label: "Safety check",
    icon: icon(<><path d="M12 21s7-3.6 7-9V5.5L12 3 5 5.5V12c0 5.4 7 9 7 9z" /><path d="M12 8v4l2.5 1.5" /></>),
  },
  {
    to: "/profile",
    label: "My account",
    icon: icon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="3.5" /></>),
  },
];

function Wordmark() {
  return (
    <div className="sidebar-mark">
      Quiet Record
      <em>Your money, in one place</em>
    </div>
  );
}

export default function Layout({ user, onLogout, triggerStatus, children }) {
  useLocation(); // re-render the active nav mark on navigation

  const armed = triggerStatus?.is_triggered
    ? { tone: "is-fired", text: "Everything has been sent" }
    : triggerStatus?.is_timer_active && triggerStatus?.seconds_until_trigger <= 0
      ? { tone: "is-fired", text: "Sending now" }
      : triggerStatus?.is_timer_active
        ? { tone: "", text: "Safety check is on" }
        : { tone: "is-idle", text: "Safety check is off" };

  return (
    <div className="shell">
      <header className="mobile-header">
        <Wordmark />
        <button className="secondary" onClick={onLogout}>Sign out</button>
      </header>

      <aside className="sidebar">
        <div className="sidebar-top">
          <Wordmark />
        </div>
        <div className="sidebar-divider" />

        <nav className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              {link.icon}
              <span className="nav-link__label">{link.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-status">
            <span className={`status-dot ${armed.tone}`} />
            {armed.text}
          </div>
          <div className="user-pill">
            <div className="user-pill__label">Signed in as</div>
            <div className="user-pill__name">{user.name}</div>
          </div>
          <button className="ghost-btn" onClick={onLogout}>Sign out</button>
        </div>
      </aside>

      <main className="content-area">
        <div className="page-shell">{children}</div>
      </main>
    </div>
  );
}
