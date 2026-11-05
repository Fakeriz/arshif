import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type SessionValue = { session: Session | null; ready: boolean };

const SessionContext = createContext<SessionValue>({ session: null, ready: false });

/** Sesi Supabase Auth. `ready` = sesi tersimpan sudah dibaca (hindari kilasan layar login). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SessionValue>({ session: null, ready: false });
  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => alive && setValue({ session: data.session, ready: true }))
      .catch(() => alive && setValue({ session: null, ready: true }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setValue({ session, ready: true }));
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
