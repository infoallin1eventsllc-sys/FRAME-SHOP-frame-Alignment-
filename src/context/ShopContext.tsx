import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Customer, Invoice, Project } from '../types';
import { CUSTOMERS, INVOICES, PROJECTS } from '../data/seed';

interface ShopContextType {
  customers: Customer[];
  projects: Project[];
  invoices: Invoice[];
}

const ShopContext = createContext<ShopContextType | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [customers] = useState<Customer[]>(CUSTOMERS);
  const [projects] = useState<Project[]>(PROJECTS);
  const [invoices] = useState<Invoice[]>(INVOICES);

  return (
    <ShopContext.Provider value={{ customers, projects, invoices }}>
      {children}
    </ShopContext.Provider>
  );
}

export function useShop(): ShopContextType {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
