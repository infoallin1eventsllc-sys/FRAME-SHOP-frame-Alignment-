import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Customer, Project, Invoice, View } from '../types';
import {
  fetchCustomers, insertCustomer, updateCustomer as updateCustomerDB,
  fetchProjects,  insertProject,  updateProject  as updateProjectDB,
  fetchInvoices,  insertInvoice,  updateInvoice  as updateInvoiceDB,
} from '../lib/db';

interface AppContextType {
  customers: Customer[];
  projects: Project[];
  invoices: Invoice[];
  loading: boolean;
  activeView: View;
  setActiveView: (view: View) => void;
  addCustomer: (c: Customer) => Promise<void>;
  updateCustomer: (c: Customer) => Promise<void>;
  addProject: (p: Project) => Promise<void>;
  updateProject: (p: Project) => Promise<void>;
  addInvoice: (i: Invoice) => Promise<void>;
  updateInvoice: (i: Invoice) => Promise<void>;
  getCustomerById: (id: string) => Customer | undefined;
  getProjectById: (id: string) => Project | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');

  useEffect(() => {
    (async () => {
      const [c, p, i] = await Promise.all([
        fetchCustomers(),
        fetchProjects(),
        fetchInvoices(),
      ]);
      setCustomers(c);
      setProjects(p);
      setInvoices(i);
      setLoading(false);
    })();
  }, []);

  const addCustomer = async (c: Customer) => {
    const saved = await insertCustomer(c);
    setCustomers(prev => [saved, ...prev]);
  };
  const updateCustomer = async (c: Customer) => {
    const saved = await updateCustomerDB(c);
    setCustomers(prev => prev.map(x => (x.id === c.id ? saved : x)));
  };

  const addProject = async (p: Project) => {
    const saved = await insertProject(p);
    setProjects(prev => [saved, ...prev]);
  };
  const updateProject = async (p: Project) => {
    const saved = await updateProjectDB(p);
    setProjects(prev => prev.map(x => (x.id === p.id ? saved : x)));
  };

  const addInvoice = async (i: Invoice) => {
    const saved = await insertInvoice(i);
    setInvoices(prev => [saved, ...prev]);
  };
  const updateInvoice = async (i: Invoice) => {
    const saved = await updateInvoiceDB(i);
    setInvoices(prev => prev.map(x => (x.id === i.id ? saved : x)));
  };

  const getCustomerById = (id: string) => customers.find(c => c.id === id);
  const getProjectById  = (id: string) => projects.find(p => p.id === id);

  return (
    <AppContext.Provider value={{
      customers, projects, invoices,
      loading, activeView, setActiveView,
      addCustomer, updateCustomer,
      addProject,  updateProject,
      addInvoice,  updateInvoice,
      getCustomerById, getProjectById,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
