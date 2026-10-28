'use client';

import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } },
});

export function Providers({ children }) {
  // Daftarkan service worker (cuma di production, biar dev nggak ke-cache)
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.update().catch(() => {})
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('arshif:sw-update'))
              toast('A new Arshif version is ready', {
                action: {
                  label: 'Refresh',
                  onClick: () => window.location.reload(),
                },
                duration: 10000,
              })
            }
          })
        })
      }).catch((error) => {
        console.warn('Service worker registration failed:', error)
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
