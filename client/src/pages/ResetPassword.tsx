import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import { toast } from '../components/Toast';
import { Spinner } from '../components/Loading';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => { setDone(true); setTimeout(() => navigate('/login'), 3000); },
    onError: (err) => toast.error(err.message),
  });

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 p-4">
        <div className="card w-full max-w-sm p-6 text-center">
          <p className="text-red-600 font-medium">Invalid reset link.</p>
          <Link to="/login" className="btn btn-primary mt-4 w-full">Back to Login</Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 p-4">
        <div className="card w-full max-w-sm p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold">Password changed!</h2>
          <p className="text-sm text-ink-500">Redirecting you to login…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-ink-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl font-bold text-brand-900">E</div>
          <h1 className="text-2xl font-bold text-white">ETI Hub</h1>
          <p className="mt-1 text-sm text-brand-200">Set a new password</p>
        </div>

        <div className="card p-6 space-y-4">
          <div>
            <label className="label">New password (min 8 characters)</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            {confirm && newPassword !== confirm && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>
          <button
            onClick={() => {
              if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
              if (newPassword !== confirm) { toast.error('Passwords do not match'); return; }
              reset.mutate({ token, newPassword });
            }}
            disabled={reset.isPending || newPassword !== confirm || newPassword.length < 8}
            className="btn btn-primary w-full"
          >
            {reset.isPending ? <Spinner /> : 'Set New Password'}
          </button>
          <Link to="/login" className="block text-center text-sm text-ink-500 hover:text-ink-700">
            ← Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
