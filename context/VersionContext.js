import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VersionContext = createContext();

export const VERSIONS = [
  { id: 'web', label: 'WEB - World English Bible', short: 'WEB' },
  { id: 'kjv', label: 'KJV - King James Version', short: 'KJV' },
  { id: 'bbe', label: 'BBE - Bible in Basic English', short: 'BBE' },
  { id: 'asv', label: 'ASV - American Standard', short: 'ASV' },
];

export function VersionProvider({ children }) {
  const [version, setVersionState] = useState('web');
  const [selectedVersion, setSelectedVersion] = useState('web');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('bible_version');
        if (saved) {
          setVersionState(saved);
          setSelectedVersion(saved);
        }
      } catch {}
    })();
  }, []);

  const setVersion = async (v) => {
    const lower = String(v).toLowerCase();
    setVersionState(lower);
    setSelectedVersion(lower);
    try { await AsyncStorage.setItem('bible_version', lower); } catch {}
  };

  return (
    <VersionContext.Provider value={{ version, selectedVersion, setVersion, versions: VERSIONS, VERSIONS }}>
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  const ctx = useContext(VersionContext);
  if (!ctx) return { version: 'web', selectedVersion: 'web', setVersion: () => {}, versions: VERSIONS };
  return ctx;
}
