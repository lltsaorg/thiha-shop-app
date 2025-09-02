"use client";

import React, { createContext, useContext, useState } from "react";

export type ProductLite = { id: number; name: string; price: number };
export type SelectedItem = { id: string; product: ProductLite; quantity: number };

type Ctx = {
  items: SelectedItem[];
  setItems: React.Dispatch<React.SetStateAction<SelectedItem[]>>;
  addOrUpdate: (row: SelectedItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const SelectedItemsContext = createContext<Ctx | null>(null);

export function SelectedItemsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SelectedItem[]>([]);

  const addOrUpdate = (row: SelectedItem) => {
    setItems((prev) => {
      const exists = prev.some((p) => p.id === row.id);
      return exists ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row];
    });
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const clear = () => setItems([]);

  return (
    <SelectedItemsContext.Provider value={{ items, setItems, addOrUpdate, remove, clear }}>
      {children}
    </SelectedItemsContext.Provider>
  );
}

export function useSelectedItems() {
  const ctx = useContext(SelectedItemsContext);
  if (!ctx) throw new Error("useSelectedItems must be used within SelectedItemsProvider");
  return ctx;
}

