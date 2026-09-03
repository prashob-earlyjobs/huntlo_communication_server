import { NavLink, Outlet } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/logs', label: 'Logs', end: false },
  { to: '/docs', label: 'Documentation', end: false },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="eyebrow sidebar-brand">Humtlo</p>
        <nav className="sidebar-nav" aria-label="Main">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' is-active' : ''}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="app-content">
        <Outlet />
      </div>
    </div>
  )
}
