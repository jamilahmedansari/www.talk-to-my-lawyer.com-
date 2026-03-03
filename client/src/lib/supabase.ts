import { createClient, type SupabaseClient, type RealtimeChannel } from "@supabase/supabase-js";

// ─── Supabase client singleton (frontend only) ────────────────────────────────
// Used for:
//   1. Supabase Auth — social OAuth (Google, Apple) + session management
//   2. Realtime subscriptions — letter status updates
//
// All data queries go through tRPC. The anon key is safe to expose in the
// browser — RLS policies enforce row-level access on the database side.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
) as string;

/**
 * Storage key layout:
 *   sb_session       — Supabase's own key: stores the FULL serialized session
 *                      JSON (access_token + refresh_token + expiry + user).
 *                      Supabase reads this on page reload to restore the session.
 *   sb_access_token  — Bare JWT string consumed by main.tsx → tRPC httpBatchLink
 *                      Authorization header. Written by our custom storage and
 *                      the onAuthStateChange listener.
 *   sb_refresh_token — Mirror of the refresh token for debugging / manual use.
 *
 * IMPORTANT: sb_session and sb_access_token MUST be different keys.
 * Supabase persists the full session JSON to `storageKey`. If we used
 * "sb_access_token" as the storageKey, the custom setItem would overwrite the
 * full JSON with the bare token, breaking session restore on reload.
 */
const SUPABASE_SESSION_KEY = "sb_session";
const TRPC_TOKEN_KEY = "sb_access_token";
const TRPC_REFRESH_KEY = "sb_refresh_token";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: { eventsPerSecond: 10 },
      },
      auth: {
        // Enable full Supabase Auth session management.
        // This is required for social OAuth (Google, Apple) to work correctly:
        //   - autoRefreshToken: keeps the session alive silently
        //   - persistSession: stores the session in localStorage
        //   - detectSessionInUrl: exchanges the OAuth code on /auth/callback
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // Supabase stores the FULL session JSON under this key.
        // It must NOT collide with the bare-token key that tRPC reads.
        storageKey: SUPABASE_SESSION_KEY,
        storage: {
          getItem: (key: string) => localStorage.getItem(key),
          setItem: (key: string, value: string) => {
            // Persist the full session JSON under the Supabase session key
            localStorage.setItem(key, value);

            // Mirror the bare access token to the tRPC key whenever Supabase
            // writes or refreshes the session
            if (key === SUPABASE_SESSION_KEY) {
              try {
                const parsed = JSON.parse(value);
                if (parsed?.access_token) {
                  localStorage.setItem(TRPC_TOKEN_KEY, parsed.access_token);
                  localStorage.setItem(TRPC_REFRESH_KEY, parsed.refresh_token ?? "");
                }
              } catch {
                // Not JSON — ignore
              }
            }
          },
          removeItem: (key: string) => {
            localStorage.removeItem(key);
            // When Supabase clears the session, also clear the tRPC keys
            if (key === SUPABASE_SESSION_KEY) {
              localStorage.removeItem(TRPC_TOKEN_KEY);
              localStorage.removeItem(TRPC_REFRESH_KEY);
            }
          },
        },
      },
    });

    // Belt-and-suspenders: keep tRPC token keys in sync whenever the session
    // changes (login, refresh, logout). This catches edge cases where the
    // custom storage setItem above might not fire (e.g. signOut clears state
    // without writing to storage).
    _client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem(TRPC_TOKEN_KEY, session.access_token);
        localStorage.setItem(TRPC_REFRESH_KEY, session.refresh_token ?? "");
      } else {
        localStorage.removeItem(TRPC_TOKEN_KEY);
        localStorage.removeItem(TRPC_REFRESH_KEY);
      }
    });
  }
  return _client;
}

// ─── Social OAuth helpers ─────────────────────────────────────────────────────

export type OAuthProvider = "google" | "apple";

/**
 * Initiates a social OAuth sign-in flow.
 * Redirects the browser to the provider's consent screen.
 * On success the provider redirects back to /auth/callback.
 *
 * @param provider  "google" | "apple"
 * @param next      Optional path to redirect to after successful login (e.g. "/dashboard")
 */
export async function signInWithOAuth(
  provider: OAuthProvider,
  next?: string | null
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.error("[OAuth] Supabase client not initialised — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
    return;
  }

  const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });

  if (error) {
    console.error(`[OAuth] ${provider} sign-in error:`, error.message);
    throw error;
  }
}

/**
 * Signs the current user out of Supabase Auth and clears local storage.
 * Call this in addition to the tRPC auth.logout mutation.
 */
export async function supabaseSignOut(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
  localStorage.removeItem(SUPABASE_SESSION_KEY);
  localStorage.removeItem(TRPC_TOKEN_KEY);
  localStorage.removeItem(TRPC_REFRESH_KEY);
}

// ─── Channel registry to avoid duplicate subscriptions ────────────────────────

const activeChannels = new Map<string, RealtimeChannel>();

export function getOrCreateChannel(
  key: string,
  factory: (client: SupabaseClient) => RealtimeChannel
): RealtimeChannel | null {
  const client = getSupabaseClient();
  if (!client) return null;
  if (activeChannels.has(key)) return activeChannels.get(key)!;
  const channel = factory(client);
  activeChannels.set(key, channel);
  return channel;
}

export function removeChannel(key: string): void {
  const client = getSupabaseClient();
  const channel = activeChannels.get(key);
  if (client && channel) {
    client.removeChannel(channel);
    activeChannels.delete(key);
  }
}
