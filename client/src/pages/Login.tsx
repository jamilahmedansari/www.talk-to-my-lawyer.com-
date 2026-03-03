import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  getRoleDashboard,
  isRoleAllowedOnPath,
} from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { signInWithOAuth } from "@/lib/supabase";

export default function Login() {
  const [, navigate] = useLocation();
  const search = useSearch();

  const utils = trpc.useUtils();

  // Parse ?next= from query string
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setOauthLoading(provider);
    try {
      await signInWithOAuth(provider, nextPath);
      // Browser will redirect — no further action needed here
    } catch (err: any) {
      toast.error(`Could not sign in with ${provider === "google" ? "Google" : "Apple"}`, {
        description: err?.message ?? "Please try again.",
      });
      setOauthLoading(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Helper with timeout + retry for cold-start resilience
      const doLogin = async (attempt: number) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const resp = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return resp;
        } catch (err) {
          clearTimeout(timeoutId);
          if (attempt < 2) return doLogin(attempt + 1);
          throw err;
        }
      };

      const response = await doLogin(0);
      const data = await response.json();

      if (!response.ok) {
        const msg =
          data.error || "Login failed. Please check your credentials.";
        setError(msg);
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setShowResendVerification(true);
        }
        toast.error(msg);
        setLoading(false);
        return;
      }

      // Store the access token for tRPC requests
      if (data.session?.access_token) {
        localStorage.setItem("sb_access_token", data.session.access_token);
        localStorage.setItem(
          "sb_refresh_token",
          data.session.refresh_token || ""
        );
      }

      // Invalidate the auth.me query to refresh user state
      await utils.auth.me.invalidate();

      toast.success("Signed in successfully", {
        description: "Welcome back. Redirecting to your dashboard.",
      });

      // Role-based redirect — honour ?next= if the role is allowed on that path
      const role =
        data.user?.role ??
        data.session?.user?.user_metadata?.role ??
        "subscriber";
      if (nextPath && isRoleAllowedOnPath(role, nextPath)) {
        navigate(nextPath);
      } else {
        navigate(getRoleDashboard(role));
      }
    } catch (err: any) {
      const msg =
        err?.name === "AbortError"
          ? "Request timed out. Please try again — the server may be warming up."
          : "An unexpected error occurred. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310419663031738932/OabHhALgbskSzGQq.png"
              alt="Talk to My Lawyer"
              className="w-12 h-12 object-contain"
            />
            <span className="text-2xl font-bold text-slate-900">
              Talk to My Lawyer
            </span>
          </Link>
          <p className="text-slate-500 text-sm">
            Professional legal letters drafted and reviewed by attorneys
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl font-semibold text-center">
              Sign In
            </CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                  {showResendVerification && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      {resendSent ? (
                        <p className="text-green-700 text-xs font-medium">
                          Verification email sent! Check your inbox.
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={resendLoading}
                          onClick={async () => {
                            setResendLoading(true);
                            try {
                              const res = await fetch(
                                "/api/auth/resend-verification",
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  credentials: "include",
                                  body: JSON.stringify({ email }),
                                }
                              );
                              const d = await res.json();
                              setResendSent(true);
                              toast.success("Verification email sent", {
                                description: d.message || "Check your inbox.",
                              });
                            } catch {
                              toast.error("Could not resend email", {
                                description: "Please try again.",
                              });
                            } finally {
                              setResendLoading(false);
                            }
                          }}
                          className="text-indigo-700 hover:underline text-xs font-medium disabled:opacity-50"
                        >
                          {resendLoading
                            ? "Sending…"
                            : "Resend verification email"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* ─── Social OAuth divider ─── */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-medium tracking-wide">
                  Or continue with
                </span>
              </div>
            </div>

            {/* ─── Google ─── */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
              disabled={oauthLoading !== null || loading}
              onClick={() => handleOAuthSignIn("google")}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            {/* ─── Apple ─── */}
            <Button
              type="button"
              variant="outline"
              className="w-full mt-3 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
              disabled={oauthLoading !== null || loading}
              onClick={() => handleOAuthSignIn("apple")}
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
                </svg>
              )}
              Continue with Apple
            </Button>

            <div className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
              >
                Create one
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-slate-600">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-slate-600">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
