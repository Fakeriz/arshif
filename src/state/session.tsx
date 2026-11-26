import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

import { clearUserLocalData } from './sessionCleanup';

type SessionValue = { session: Session | null; ready: boolean };

const SessionContext = createContext<SessionValue>({ session: null, ready: false });

/** Sesi Supabase Auth. `ready` = sesi tersimpan sudah dibaca (hindari kilasan layar login). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SessionValue>({ session: null, ready: false });
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const applySession = (session: Session | null) => {
      const nextId = session?.user.id ?? null;
      if (lastUserId.current && lastUserId.current !== nextId) {
        void clearUserLocalData(lastUserId.current);
      }
      lastUserId.current = nextId;
      if (alive) setValue({ session, ready: true });
    };
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => applySession(null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  return useContext(SessionContext);
}
