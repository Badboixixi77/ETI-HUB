import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { useStore } from '../lib/store';
import { toast } from '../components/Toast';
import { Spinner } from '../components/Loading';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();

  // Redirect if already logged in
  useEffect(() => {
    utils.auth.me.fetch().then((user) => {
      if (user) {
        setUser(user);
        navigate('/dashboard');
      }
    }).catch(() => {});
  }, []);

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      setUser(data.user);
      utils.auth.me.invalidate();
      toast.success('Welcome back!');
      navigate('/dashboard');
    },
    onError: (err) => {
      toast.error(err.message || 'Login failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
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
          <p className="mb-6 text-sm text-ink-500">Enter your credentials to access the hub</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@etiandpartners.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={1}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-600"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={login.isPending}
              className="btn btn-primary w-full"
            >
              {login.isPending ? <Spinner /> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-brand-200/60">
          Internal platform · Authorized personnel only
        </p>
      </div>
    </div>
  );
}
