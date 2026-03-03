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
        // Store tokens under our own keys so the tRPC httpBatchLink can read them
        storageKey: "sb_access_token",
        storage: {
          getItem: (key: string) => localStorage.getItem(key),
          setItem: (key: string, value: string) => {
            localStorage.setItem(key, value);
            // Also keep the bare access token key that main.tsx reads for tRPC headers
            if (key === "sb_access_token") {
              try {
                const parsed = JSON.parse(value);
                if (parsed?.access_token) {
                  localStorage.setItem("sb_access_token", parsed.access_token);
                  localStorage.setItem("sb_refresh_token", parsed.refresh_token ?? "");
                }
              } catch {
                // value is already the raw token string
                localStorage.setItem("sb_access_token", value);
              }
            }
          },
          removeItem: (key: string) => localStorage.removeItem(key),
        },
      },
    });

    // Keep tRPC token keys in sync whenever the session changes
    _client.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        localStorage.setItem("sb_access_token", session.access_token);
        localStorage.setItem("sb_refresh_token", session.refresh_token ?? "");
      } else {
        localStorage.removeItem("sb_access_token");
        localStorage.removeItem("sb_refresh_token");
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
  localStorage.removeItem("sb_access_token");
  localStorage.removeItem("sb_refresh_token");
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
