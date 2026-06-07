import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Aurora } from './components/bits/Aurora';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import PaymentOverview from './pages/PaymentOverview';
import AuditLog from './pages/AuditLog';
import Settings from './pages/Settings';

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/payments', label: 'Payments' },
  { to: '/audit', label: 'Audit Log' },
  { to: '/settings', label: 'Settings' },
];

function Nav() {
  return (
    <nav className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">DevAssets</span>
        </div>
        <div className="flex items-center gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Aurora />
      <div className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-6xl px-6 py-8">
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
