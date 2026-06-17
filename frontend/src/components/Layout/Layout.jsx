import { NavLink, useLocation } from "react-router-dom";
import "./Layout.css";

const links = [
  {
    to: "/",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    )
  },
  {
    to: "/records",
    label: "Records",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    )
  },
  {
    to: "/contacts",
    label: "Contacts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  },
  {
    to: "/trigger",
    label: "Trigger",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    )
  },
  {
    to: "/profile",
    label: "Profile",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }
];

const pageTitles = {
  "/": "Dashboard",
  "/records": "Records",
  "/contacts": "Trusted Contacts",
  "/trigger": "Safety Trigger",
  "/profile": "Profile",
};

export default function Layout({ user, onLogout, triggerStatus, children }) {
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || "Dashboard";

  return (
    <div className="shell shell-modern">
      <header className="mobile-header">
        <div className="brand death-title brand-small">Galaxio</div>
        <button className="logout-btn-mobile" onClick={onLogout}>Logout</button>
      </header>

      <aside className="sidebar sidebar-modern">
        <div className="sidebar-top">
          <div className="brand death-title brand-small">Galaxio</div>
        </div>

        <nav className="nav-links nav-links-modern">
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
          <div className="user-pill">
            <div className="muted">Signed in as</div>
            <div className="user-pill__name">{user.name}</div>
          </div>
          <button className="secondary full-width" onClick={onLogout}>Logout</button>
        </div>
      </aside>

      <main className="content-area content-area-modern">
        <div className="page-shell">

          {children}
        </div>
      </main>
    </div>
  );
}
