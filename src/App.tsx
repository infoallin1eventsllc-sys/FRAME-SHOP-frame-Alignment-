import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { BillingPage } from './components/billing/BillingPage';
import { ProjectsPage } from './components/projects/ProjectsPage';
import { CustomersPage } from './components/customers/CustomersPage';

function AppShell() {
  const { activeView } = useApp();

  const pages: Record<string, React.ReactNode> = {
    dashboard: <DashboardPage />,
    billing: <BillingPage />,
    projects: <ProjectsPage />,
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
