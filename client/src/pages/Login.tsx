import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useStore } from "../lib/store";
import { toast } from "../components/Toast";
import { Spinner } from "../components/Loading";
import { ToastContainer } from "../components/Toast";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const utils = trpc.useUtils();

  useEffect(() => {
    utils.auth.me
      .fetch()
      .then((user) => {
        if (user) {
          setUser(user);
          navigate("/dashboard");
        }
      })
      .catch(() => {});
  }, []);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setUser(data.user);
      utils.auth.me.invalidate();
      toast.success("Welcome back!");
      navigate("/dashboard");
    },
    onError: (err) => toast.error(err.message || "Login failed"),
  });

  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setForgotSent(true),
    onError: (err) => toast.error(err.message),
  });

  if (forgotMode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 p-4">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl font-bold text-brand-900">
              E
            </div>
            <h1 className="text-2xl font-bold text-white">ETI Hub</h1>
          </div>
          <div className="card p-6 space-y-4">
            {forgotSent ? (
              <div className="text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="font-semibold">Check your email</h2>
                <p className="text-sm text-ink-500">
                  If that email is registered, you'll receive a reset link
                  shortly.
                </p>
                <button
                  onClick={() => {
                    setForgotMode(false);
                    setForgotSent(false);
                  }}
                  className="btn btn-secondary w-full"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold">Reset password</h2>
                <p className="text-sm text-ink-500">
                  Enter your email and we'll send you a reset link.
                </p>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="you@eti-trade.com"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => forgotPassword.mutate({ email: forgotEmail })}
                  disabled={forgotPassword.isPending || !forgotEmail}
                  className="btn btn-primary w-full"
                >
                  {forgotPassword.isPending ? <Spinner /> : "Send Reset Link"}
                </button>
                <button
                  onClick={() => setForgotMode(false)}
                  className="block w-full text-center text-sm text-ink-500 hover:text-ink-700"
                >
                  ← Back to login
                </button>
              </>
            )}
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl font-bold text-brand-900">
            E
          </div>
          <h1 className="text-2xl font-bold text-white">ETI Hub</h1>
          <p className="mt-1 text-sm text-brand-200">ETI & PARTNERS LIMITED</p>
          <p className="text-xs text-brand-300/70">Lagos · London</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-1 text-lg font-semibold">Sign in</h2>
          <p className="mb-6 text-sm text-ink-500">
            Enter your credentials to access the hub
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              login.mutate({ email, password });
            }}
            className="space-y-4"
          >
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@eti-trade.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="input pr-14"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-600"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="text-xs text-brand-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="btn btn-primary w-full"
            >
              {login.isPending ? <Spinner /> : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-brand-200/60">
          Internal platform · Authorized personnel only
        </p>
      </div>
      <ToastContainer />
    </div>
  );
}
