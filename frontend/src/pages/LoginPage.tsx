import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginUser } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { ApiError } from '../types';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, accessToken } = await loginUser(email, password);
      setAuth(accessToken, user);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={onSubmit}>
        <div>
          <div className="topbar-brand" style={{ marginBottom: 4 }}>
            <span className="dot" />
            RouteForge
          </div>
          <h1 className="auth-title">Log in</h1>
          <p className="auth-subtitle">Plan and optimize your delivery routes.</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Logging in…' : 'Log in'}
        </button>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          Don&rsquo;t have an account? <Link to="/register" style={{ color: 'var(--accent)' }}>Register</Link>
        </p>
      </form>
    </div>
  );
}
