import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useMockData } from '../api/client';
import { ROLE_COLORS, ROLE_LABELS } from '../utils/roleStore';
import { EventOSLogo } from '../brand/EventOSLogo';
import './AppLayout.css';

/** SVG icons — inline so there's no extra dependency */
function IconEvents() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconTemplates() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconDesigns() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function IconOrgTemplates() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconSOW() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
      <path d="M9 3v6h6" />
      <path d="M9 3l6 6" />
      <path d="M12 17v-4" />
      <path d="M10 15l2 2 2-2" />
    </svg>
  );
}

function IconGenerators() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconAdminPanel() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function AppLayout() {
  const { user, isAdmin, role, can, clearUser } = useUser();
  const isMock = useMockData();
  const navigate = useNavigate();

  function handleLogout() {
    if (confirm('Sign out of Event Ops?')) clearUser();
  }

  const initial = user ? user.name.charAt(0).toUpperCase() : '?';
  const roleStyle = role ? ROLE_COLORS[role] : null;

  return (
    <div className="layout">
      <aside className="layout__sidebar" aria-label="Main navigation">
        {/* Brand */}
        <div className="layout__brand">
          <div className="layout__logo-img layout__logo-img--icon">
            <EventOSLogo size={2.6} wordmark={false} />
          </div>
          <div className="layout__logo-img--full">
            <EventOSLogo size={3.5} />
          </div>
        </div>

        {/* Nav */}
        <nav className="layout__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
            title="Events"
          >
            <span className="layout__link-icon"><IconEvents /></span>
            <span className="layout__link-label">Events</span>
          </NavLink>

          {can('events.view') && (
            <NavLink
              to="/calendar"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="Calendar"
            >
              <span className="layout__link-icon"><IconCalendar /></span>
              <span className="layout__link-label">Calendar</span>
            </NavLink>
          )}

          <NavLink
            to="/team"
            className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
            title="Team"
          >
            <span className="layout__link-icon"><IconTeam /></span>
            <span className="layout__link-label">Team</span>
          </NavLink>

          {can('task_templates') && (
            <NavLink
              to="/tasks"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="Tasks"
            >
              <span className="layout__link-icon"><IconTemplates /></span>
              <span className="layout__link-label">Tasks</span>
            </NavLink>
          )}

          {can('templates.view') && (
            <NavLink
              to="/templates"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="Templates"
            >
              <span className="layout__link-icon"><IconOrgTemplates /></span>
              <span className="layout__link-label">Templates</span>
            </NavLink>
          )}

          {can('designs') && (
            <NavLink
              to="/designs"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="Designs"
            >
              <span className="layout__link-icon"><IconDesigns /></span>
              <span className="layout__link-label">Designs</span>
            </NavLink>
          )}

          {can('generators') && (
            <NavLink
              to="/generators"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="Generators"
            >
              <span className="layout__link-icon"><IconGenerators /></span>
              <span className="layout__link-label">Generators</span>
            </NavLink>
          )}

          {can('sow_generator') && (
            <NavLink
              to="/sow-generator"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="SOW Generator"
            >
              <span className="layout__link-icon"><IconSOW /></span>
              <span className="layout__link-label">SOW Generator</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/reports"
              className={({ isActive }) => `layout__link${isActive ? ' active' : ''}`}
              title="Reports"
            >
              <span className="layout__link-icon"><IconReports /></span>
              <span className="layout__link-label">Reports</span>
            </NavLink>
          )}
        </nav>

        {/* Admin panel shortcut — only visible to admins */}
        {isAdmin && (
          <button
            type="button"
            className="layout__admin-btn"
            onClick={() => navigate('/admin')}
            title="Admin Panel"
          >
            <span className="layout__admin-btn-icon"><IconAdminPanel /></span>
            <span className="layout__admin-btn-label">Admin Panel</span>
          </button>
        )}

        {/* User section */}
        <div className="layout__user">
          {user ? (
            <>
              <span className="layout__avatar" aria-hidden="true">{initial}</span>
              <div className="layout__user-info">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
                <div className="layout__user-meta">
                  {role && roleStyle && (
                    <span
                      className="layout__role-badge"
                      style={{ background: roleStyle.bg, color: roleStyle.color }}
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  )}
                  {isMock && (
                    <span
                      className="layout__demo"
                      title="Demo mode — events and accounts stay in this browser only; not synced to Google Sheets"
                    >
                      Demo
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="layout__logout"
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
              >
                <IconLogout />
              </button>
            </>
          ) : (
            <span className="layout__avatar" aria-hidden="true">?</span>
          )}
        </div>
      </aside>

      <main className="layout__main">
        <Outlet />
      </main>
    </div>
  );
}
