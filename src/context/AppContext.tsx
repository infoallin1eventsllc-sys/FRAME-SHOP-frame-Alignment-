import React, { createContext, useContext, useState } from 'react';
import type { Customer, Project, Invoice, View } from '../types';
import {
  customers as initialCustomers,
  projects as initialProjects,
  invoices as initialInvoices,
} from '../data/mockData';

interface AppContextType {
  customers: Customer[];
  projects: Project[];
  invoices: Invoice[];
  activeView: View;
  setActiveView: (view: View) => void;
  addCustomer: (customer: Customer) => void;
  updateCustomer: (customer: Customer) => void;
  addProject: (project: Project) => void;
  updateProject: (project: Project) => void;
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (invoice: Invoice) => void;
  getCustomerById: (id: string) => Customer | undefined;
  getProjectById: (id: string) => Project | undefined;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [activeView, setActiveView] = useState<View>('dashboard');

  const addCustomer = (c: Customer) => setCustomers(prev => [c, ...prev]);
  const updateCustomer = (c: Customer) =>
    setCustomers(prev => prev.map(x => (x.id === c.id ? c : x)));

  const addProject = (p: Project) => setProjects(prev => [p, ...prev]);
  const updateProject = (p: Project) =>
    setProjects(prev => prev.map(x => (x.id === p.id ? p : x)));

  const addInvoice = (i: Invoice) => setInvoices(prev => [i, ...prev]);
  const updateInvoice = (i: Invoice) =>
    setInvoices(prev => prev.map(x => (x.id === i.id ? i : x)));

  const getCustomerById = (id: string) => customers.find(c => c.id === id);
  const getProjectById = (id: string) => projects.find(p => p.id === id);

  return (
    <AppContext.Provider
      value={{
        customers,
        projects,
        invoices,
        activeView,
        setActiveView,
        addCustomer,
        updateCustomer,
        addProject,
        updateProject,
        addInvoice,
        updateInvoice,
        getCustomerById,
        getProjectById,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
