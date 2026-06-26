import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShopProvider } from './context/ShopContext';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Billing from './components/Billing';
import Projects from './components/Projects';
import Customers from './components/Customers';
import type { View } from './types';

function ViewRouter({ view }: { view: View }) {
  switch (view) {
    case 'dashboard': return <Dashboard />;
    case 'billing': return <Billing />;
    case 'projects': return <Projects />;
    case 'customers': return <Customers />;
  }
}

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <ShopProvider>
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar current={view} onChange={setView} />
        <AnimatePresence mode="wait">
          <motion.main
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-auto"
          >
            <ViewRouter view={view} />
          </motion.main>
        </AnimatePresence>
      </div>
    </ShopProvider>
  );
}
