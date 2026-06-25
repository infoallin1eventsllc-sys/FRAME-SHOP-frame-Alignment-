import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { BillingPage } from './components/billing/BillingPage';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { CustomersPage } from './components/customers/CustomersPage';

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center mx-auto mb-4">
          <span className="text-black font-bold">FS</span>
        </div>
        <p className="text-sm text-zinc-500 animate-pulse">Loading shop data…</p>
      </div>
    </div>
  );
}

function AppShell() {
  const { activeView, loading } = useApp();

  if (loading) return <LoadingScreen />;

  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage />,
    billing:   <BillingPage />,
    projects:  <ProjectsPage />,
    customers: <CustomersPage />,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Header view={activeView} />
        <main className="flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              className="absolute inset-0"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              {pages[activeView]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
