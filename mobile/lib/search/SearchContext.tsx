// lib/search/SearchContext.tsx
// Stato di ricerca condiviso tra Home (index.tsx) e Corsa (search.tsx): le due
// tab restano montate in memoria, quindi la barra di ricerca e la destinazione
// scelta vivono in un unico context così da restare sincronizzate in tempo reale.
// I dati vivono SOLO in memoria di sessione (nessun AsyncStorage/SecureStore).

import React, { createContext, useCallback, useContext, useState } from 'react';

export interface SearchDestination {
  addr: string;
  lat: number | null;
  lng: number | null;
}

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
  destination: SearchDestination | null;
  setDestination: (d: SearchDestination | null) => void;
  clearDestination: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  query: '',
  setQuery: () => {},
  destination: null,
  setDestination: () => {},
  clearDestination: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [destination, setDestination] = useState<SearchDestination | null>(null);

  const clearDestination = useCallback(() => setDestination(null), []);

  return (
    <SearchContext.Provider value={{ query, setQuery, destination, setDestination, clearDestination }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
