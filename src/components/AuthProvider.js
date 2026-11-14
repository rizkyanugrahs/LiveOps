"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getSupabase, isConfigured } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

const AuthContext = createContext({ user: null, profile: null, loading: true, configured: true, isGuest: false, refreshProfile: async () => {}, supabase: null });

export function AuthProvider({ children }) {
  const { setLang } = useI18n();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const configured = isConfigured();

  const loadProfile = useCallback(async (uid) => {
    const supabase = getSupabase();
    if (!supabase || !uid) return;
    let { data } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    if (!data) {
      await supabase.from("profiles").upsert({ user_id: uid }, { onConflict: "user_id" });
      const res = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
      data = res.data;
    }
    if (data) {
      setProfile(data);
      if (data.language === "id" || data.language === "en") setLang(data.language);
    }
  }, [setLang]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session ? data.session.user : null;
      setUser(u);
      if (u) loadProfile(u.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session ? session.user : null;
      setUser(u);
      if (u) loadProfile(u.id); else setProfile(null);
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => { if (user) await loadProfile(user.id); }, [user, loadProfile]);

  const value = {
    user, profile, loading, configured,
    isGuest: Boolean(user && user.is_anonymous),
    refreshProfile,
    supabase: getSupabase(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
