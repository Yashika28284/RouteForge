import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { geocodeAddress } from '../api/geocode';
import { createStop, deleteStop, getRoute, optimizeRoute, updateRoute, updateStop } from '../api/routes';
import ObjectiveToggle from '../components/optimize/ObjectiveToggle';
import OptimizeResults from '../components/optimize/OptimizeResults';
import RouteMap from '../components/map/RouteMap';
import StopForm from '../components/stops/StopForm';
import StopList from '../components/stops/StopList';
import { DEMO_DEPOT, DEMO_STOPS } from '../lib/demoRoute';
import type { OptimizationObjective, OptimizationResponse, Stop, StopInput } from '../types';
import { ApiError } from '../types';

type EditorMode = { kind: 'none' } | { kind: 'add-stop'; location?: { lat: number; lng: number } } | { kind: 'edit-stop'; stop: Stop };

export default function RouteEditorPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: route, isLoading } = useQuery({
    queryKey: ['route', routeId],
    queryFn: () => getRoute(routeId!),
    enabled: !!routeId,
  });

  const [mode, setMode] = useState<EditorMode>({ kind: 'none' });
  const [objective, setObjective] = useState<OptimizationObjective>('TIME');
  const [depotQuery, setDepotQuery] = useState('');
  const [depotEditing, setDepotEditing] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState<OptimizationResponse | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const invalidateRoute = () => queryClient.invalidateQueries({ queryKey: ['route', routeId] });

  const addStopMutation = useMutation({
    mutationFn: (input: StopInput) => createStop(routeId!, input),
    onSuccess: () => {
      invalidateRoute();
      setMode({ kind: 'none' });
      setOptimizeResult(null);
    },
  });

  const editStopMutation = useMutation({
    mutationFn: ({ stopId, input }: { stopId: string; input: StopInput }) => updateStop(routeId!, stopId, input),
    onSuccess: () => {
      invalidateRoute();
      setMode({ kind: 'none' });
      setOptimizeResult(null);
    },
  });

  const deleteStopMutation = useMutation({
    mutationFn: (stopId: string) => deleteStop(routeId!, stopId),
    onSuccess: () => {
      invalidateRoute();
      setOptimizeResult(null);
    },
  });

  const dragStopMutation = useMutation({
    mutationFn: ({ stopId, lat, lng }: { stopId: string; lat: number; lng: number }) =>
      updateStop(routeId!, stopId, { latitude: lat, longitude: lng }),
    onSuccess: async () => {
      await invalidateRoute();
      // Re-optimize automatically after a drag if this route already has a
      // result on screen, so the map stays in sync without a full reload.
      if (optimizeResult) {
        runOptimize();
      }
    },
  });

  const depotMutation = useMutation({
    mutationFn: (depot: { lat: number; lng: number; address: string }) => updateRoute(routeId!, { depot }),
    onSuccess: () => {
      invalidateRoute();
      setDepotEditing(false);
      setDepotQuery('');
      setOptimizeResult(null);
    },
  });

  const optimizeMutation = useMutation({
    mutationFn: () => optimizeRoute(routeId!, objective),
    onSuccess: (result) => {
      setOptimizeResult(result);
      setOptimizeError(null);
      invalidateRoute();
    },
    onError: (err) => {
      setOptimizeError(err instanceof ApiError ? err.body.message : 'Optimization failed. Try again.');
    },
  });

  function runOptimize() {
    setOptimizeError(null);
    optimizeMutation.mutate();
  }

  async function onDepotSearch() {
    if (!depotQuery.trim()) return;
    const results = await geocodeAddress(depotQuery);
    if (results[0]) {
      depotMutation.mutate({ lat: results[0].lat, lng: results[0].lng, address: results[0].displayName });
    }
  }

  function onMapClick(lat: number, lng: number) {
    setMode({ kind: 'add-stop', location: { lat, lng } });
  }

  function onStopDragEnd(stopId: string, lat: number, lng: number) {
    dragStopMutation.mutate({ stopId, lat, lng });
  }

  async function loadDemoRoute() {
    setLoadingDemo(true);
    try {
      await updateRoute(routeId!, { depot: { lat: DEMO_DEPOT.latitude, lng: DEMO_DEPOT.longitude, address: DEMO_DEPOT.address } });
      for (const stop of DEMO_STOPS) {
        await createStop(routeId!, {
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
        });
      }
      await invalidateRoute();
      setOptimizeResult(null);
    } finally {
      setLoadingDemo(false);
    }
  }

  if (isLoading || !route) {
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="topbar-brand">
            <span className="dot" />
            RouteForge
          </div>
        </div>
        <p style={{ padding: 24, color: 'var(--text-muted)' }}>Loading route…</p>
      </div>
    );
  }

  const stops = route.stops ?? [];
  const depot = route.depot_lat != null && route.depot_lng != null
    ? { lat: route.depot_lat, lng: route.depot_lng, address: route.depot_address }
    : null;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}>
            <span className="dot" />
            RouteForge
          </Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{route.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Dashboard
          </button>
        </div>
      </div>

      <div className="editor-shell">
        <div className="editor-panel">
          <div>
            <div className="section-title">Depot</div>
            {depot && !depotEditing ? (
              <div className="stop-row" style={{ marginBottom: 0 }}>
                <div className="stop-seq" style={{ background: 'var(--accent-2)', color: '#0e1316' }}>D</div>
                <div className="stop-info">
                  <div className="stop-address">{depot.address ?? 'Depot'}</div>
                  <div className="stop-meta">
                    {depot.lat.toFixed(4)}, {depot.lng.toFixed(4)}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setDepotEditing(true)}>
                  Change
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  placeholder="Search depot address…"
                  value={depotQuery}
                  onChange={(e) => setDepotQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-sm" onClick={onDepotSearch} disabled={depotMutation.isPending}>
                  Set
                </button>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                Stops ({stops.length}/10)
              </div>
              <button
                className="btn btn-sm"
                onClick={() => setMode({ kind: 'add-stop' })}
                disabled={stops.length >= 10}
              >
                + Add
              </button>
            </div>

            {mode.kind === 'add-stop' && (
              <div style={{ marginBottom: 10 }}>
                <StopForm
                  presetLocation={mode.location ?? null}
                  atStopLimit={stops.length >= 10}
                  submitting={addStopMutation.isPending}
                  onSubmit={(input) => addStopMutation.mutate(input)}
                  onCancel={() => setMode({ kind: 'none' })}
                />
              </div>
            )}

            {mode.kind === 'edit-stop' && (
              <div style={{ marginBottom: 10 }}>
                <StopForm
                  initial={mode.stop}
                  submitting={editStopMutation.isPending}
                  onSubmit={(input) => editStopMutation.mutate({ stopId: mode.stop.id, input })}
                  onCancel={() => setMode({ kind: 'none' })}
                />
              </div>
            )}

            <StopList
              stops={stops}
              optimizedRoute={optimizeResult?.route ?? null}
              onEdit={(stop) => setMode({ kind: 'edit-stop', stop })}
              onDelete={(stopId) => deleteStopMutation.mutate(stopId)}
            />
          </div>

          {stops.length === 0 && (
            <button className="btn" onClick={loadDemoRoute} disabled={loadingDemo}>
              {loadingDemo ? 'Loading demo route…' : 'Load demo route'}
            </button>
          )}

          <div>
            <div className="section-title">Objective</div>
            <ObjectiveToggle value={objective} onChange={setObjective} />
          </div>

          {optimizeError && <div className="error-banner">{optimizeError}</div>}

          <button
            className="btn btn-primary"
            onClick={runOptimize}
            disabled={!depot || stops.length === 0 || optimizeMutation.isPending}
          >
            {optimizeMutation.isPending ? 'Optimizing…' : 'Optimize route'}
          </button>

          {optimizeResult && <OptimizeResults result={optimizeResult} />}
        </div>

        <div className="editor-map-col">
          <div className="map-wrap">
            <RouteMap
              depot={depot}
              stops={stops}
              optimizedRoute={optimizeResult?.route ?? null}
              onMapClick={onMapClick}
              onStopDragEnd={onStopDragEnd}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
