import { NavLink, useLocation } from "react-router-dom";
import "./Layout.css";

const links = [
  ["/", "Dashboard"],
  ["/records", "Records"],
  ["/contacts", "Contacts"],
  ["/trigger", "Safety Trigger"],
  ["/profile", "Profile"],
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
      <aside className="sidebar sidebar-modern">
        <div className="sidebar-top">
          <div className="brand death-title brand-small">Quiet Record</div>
        </div>

        <nav className="nav-links nav-links-modern">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-link__label">{label}</span>
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
