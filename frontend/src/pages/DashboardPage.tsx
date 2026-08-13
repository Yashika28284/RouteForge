import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRoute, deleteRoute, listRoutes } from '../api/routes';
import { logoutUser } from '../api/auth';
import { useAuthStore } from '../store/auth';
import type { Route } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: routes, isLoading } = useQuery({ queryKey: ['routes'], queryFn: listRoutes });

  const createMutation = useMutation({
    mutationFn: () => createRoute({ name: newName || 'Untitled route' }),
    onSuccess: (route) => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      navigate(`/routes/${route.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRoute(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routes'] }),
  });

  function onCreateSubmit(e: FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  async function onLogout() {
    try {
      await logoutUser();
    } finally {
      clearAuth();
      navigate('/login');
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <span className="dot" />
          RouteForge
        </div>
        <div className="topbar-user">
          <span>{user?.email}</span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>

      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 style={{ fontSize: 22 }}>Your routes</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 13 }}>
              Plan a stop list, then optimize it against a real road network.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewForm((v) => !v)}>
            + New route
          </button>
        </div>

        {showNewForm && (
          <form
            onSubmit={onCreateSubmit}
            className="card"
            style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 20 }}
          >
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="route-name">Route name</label>
              <input
                id="route-name"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Tuesday deliveries — North zone"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </form>
        )}

        {isLoading && <p style={{ color: 'var(--text-muted)' }}>Loading routes…</p>}

        {!isLoading && routes && routes.length === 0 && (
          <div className="card empty-state">
            <h3 style={{ color: 'var(--text)' }}>No routes yet</h3>
            <p>Create a route, add up to 10 stops, and optimize the visiting order.</p>
          </div>
        )}

        {!isLoading && routes && routes.length > 0 && (
          <div className="route-grid">
            {routes.map((route: Route) => (
              <div key={route.id} className="card route-card" onClick={() => navigate(`/routes/${route.id}`)} style={{ cursor: 'pointer' }}>
                <div className={`badge ${route.status === 'OPTIMIZED' ? 'badge-optimized' : 'badge-draft'}`}>
                  {route.status}
                </div>
                <div className="route-card-title">{route.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                  Created {formatDate(route.created_at)}
                </div>
                {route.status === 'OPTIMIZED' && (
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {route.total_distance_km?.toFixed(1)} km · {Math.round(route.total_duration_min ?? 0)} min
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${route.name}"? This cannot be undone.`)) {
                        deleteMutation.mutate(route.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
