/**
 * /auth/callback
 *
 * Landing page for Supabase Social OAuth (Google, Apple).
 *
 * Flow:
 *   Provider consent screen
 *     → Supabase exchanges code for session
 *     → Supabase redirects to this page with #access_token / ?code in the URL
 *     → detectSessionInUrl (enabled in supabase.ts) exchanges the code automatically
 *     → onAuthStateChange fires with event = "SIGNED_IN"
 *     → We store the tokens, invalidate tRPC auth.me, then redirect to the dashboard
 *
 * The ?next= query param is forwarded from Login.tsx through the OAuth flow so
 * deep-links are honoured after sign-in.
 */
import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { getRoleDashboard, isRoleAllowedOnPath } from "@/components/ProtectedRoute";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  // Parse ?next= forwarded from Login.tsx
  const nextPath = (() => {
    const params = new URLSearchParams(search);
    const raw = params.get("next");
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setError("Authentication service is not configured. Please contact support.");
      return;
    }

    // detectSessionInUrl is enabled — Supabase will exchange the code/token
    // from the URL automatically. We just need to listen for the result.
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Tokens are already persisted to localStorage by the onAuthStateChange
          // listener registered in supabase.ts. Invalidate tRPC cache so auth.me
          // re-fetches and gets the role from our app database.
          try {
            await utils.auth.me.invalidate();
            const meData = await utils.auth.me.fetch();

            const role = meData?.role ?? "subscriber";

            toast.success("Signed in successfully", {
              description: "Welcome! Redirecting to your dashboard.",
            });

            // Honour ?next= deep-link if the role is allowed on that path
            if (nextPath && isRoleAllowedOnPath(role, nextPath)) {
              navigate(nextPath);
            } else {
              navigate(getRoleDashboard(role));
            }
          } catch (err) {
            console.error("[AuthCallback] Failed to fetch user after OAuth:", err);
            // Still redirect — the user is authenticated even if role fetch failed
            navigate("/dashboard");
          }
        }

        if (event === "SIGNED_OUT") {
          navigate("/login");
        }
      }
    );

    // Handle the case where the session was already exchanged before this
    // component mounted (e.g. fast redirect). Check the current session.
    client.auth.getSession().then(async ({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (session) {
        // Session already exists — the onAuthStateChange above may not fire.
        // Manually trigger the redirect.
        try {
          await utils.auth.me.invalidate();
          const meData = await utils.auth.me.fetch();
          const role = meData?.role ?? "subscriber";

          if (nextPath && isRoleAllowedOnPath(role, nextPath)) {
            navigate(nextPath);
          } else {
            navigate(getRoleDashboard(role));
          }
        } catch {
          navigate("/dashboard");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Sign-in failed</h1>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <a
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
        <p className="text-slate-600 text-sm font-medium">Completing sign-in…</p>
        <p className="text-slate-400 text-xs mt-1">You will be redirected shortly.</p>
      </div>
    </div>
  );
}
