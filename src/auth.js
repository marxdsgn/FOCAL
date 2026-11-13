import { createClient } from "@supabase/supabase-js";
let clientPromise,
  sessionPromise,
  currentSession = null,
  recovery = false;
const listeners = new Set();
function emit() {
  const value = { session: currentSession, recovery, ready: true };
  for (const fn of listeners) fn(value);
  window.dispatchEvent(
    new CustomEvent("focal-session-changed", { detail: value }),
  );
}
async function syncCookie(session) {
  try {
    await fetch(session ? "/api/auth/session" : "/api/auth/logout", {
      method: "POST",
      headers: session
        ? { Authorization: "Bearer " + session.access_token }
        : {},
    });
  } catch {}
}
export function getAuthClient() {
  return (clientPromise ||= (async () => {
    const response = await fetch("/api/config");
    let config;
    try {
      config = await response.json();
    } catch {
      throw Error("Start the FOCAL server to use accounts.");
    }
    if (!response.ok || !config.supabaseUrl || !config.anonKey)
      throw Error("Account service is not configured yet.");
    const client = createClient(config.supabaseUrl, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "focal_independent_session",
      },
    });
    client.auth.onAuthStateChange((event, session) => {
      currentSession = session;
      if (event === "PASSWORD_RECOVERY") recovery = true;
      if (event === "SIGNED_OUT") recovery = false;
      queueMicrotask(() => {
        syncCookie(session);
        emit();
      });
    });
    return client;
  })());
}
export function loadSession() {
  return (sessionPromise ||= (async () => {
    const client = await getAuthClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentSession = data.session;
    await syncCookie(currentSession);
    emit();
    return currentSession;
  })());
}
export async function accessToken() {
  await loadSession();
  const client = await getAuthClient();
  const { data } = await client.auth.getSession();
  return data.session?.access_token || null;
}
export function subscribeAuth(fn) {
  listeners.add(fn);
  loadSession()
    .then(() => fn({ session: currentSession, recovery, ready: true }))
    .catch((error) =>
      fn({ session: null, recovery: false, ready: true, error: error.message }),
    );
  return () => listeners.delete(fn);
}
export function clearRecovery() {
  recovery = false;
  emit();
}
export async function signOut() {
  const client = await getAuthClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  currentSession = null;
  await syncCookie(null);
  emit();
}
