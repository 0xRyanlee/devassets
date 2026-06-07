import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import PaymentOverview from './pages/PaymentOverview';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';

function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1 rounded text-sm ${isActive ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`;

  return (
    <nav className="flex items-center gap-1 px-4 py-3 bg-gray-900 border-b border-gray-800">
      <span className="text-white font-bold mr-6">DevAssets</span>
      <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
      <NavLink to="/payments" className={linkClass}>Payments</NavLink>
      <NavLink to="/audit" className={linkClass}>Audit Log</NavLink>
      <NavLink to="/settings" className={linkClass}>Settings</NavLink>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Nav />
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/payments" element={<PaymentOverview />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
