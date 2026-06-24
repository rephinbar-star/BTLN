import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "@/lib/session";
import { identifyUser, resetUser } from "@/lib/analytics";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (event === "SIGNED_IN" && newSession?.user) {
        // PII firewall: identify with UUID only — never email or name.
        identifyUser(newSession.user.id);
        // Defer to avoid deadlock with auth callback
        setTimeout(() => {
          const sid = getSessionId();
          void supabase.rpc("claim_anonymous_analyses", {
            p_session_id: sid,
            p_user_id: newSession.user!.id,
          });
        }, 0);
      }
      if (event === "SIGNED_OUT") {
        resetUser();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session?.user) identifyUser(data.session.user.id);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);