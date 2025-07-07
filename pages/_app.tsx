import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import '@/styles/globals.css';
import useStore from '@/lib/store';

export default function App({ Component, pageProps }: AppProps) {
  const loadOutpostData = useStore((state) => state.loadOutpostData);

  useEffect(() => {
    // Load Outpost data when app starts
    loadOutpostData();
  }, [loadOutpostData]);

  return <Component {...pageProps} />;
} 