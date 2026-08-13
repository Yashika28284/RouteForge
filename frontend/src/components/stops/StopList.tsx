import type { OptimizedStop, Stop } from '../../types';

interface StopListProps {
  stops: Stop[];
  optimizedRoute: OptimizedStop[] | null;
  onEdit: (stop: Stop) => void;
  onDelete: (stopId: string) => void;
}

function formatWindow(start: string | null, end: string | null) {
  if (!start && !end) return null;
  return `${start?.slice(0, 5) ?? '—'}–${end?.slice(0, 5) ?? '—'}`;
}

export default function StopList({ stops, optimizedRoute, onEdit, onDelete }: StopListProps) {
  const displayStops = optimizedRoute
    ? optimizedRoute
        .map((os) => ({ os, stop: stops.find((s) => s.id === os.stopId) }))
        .filter((x): x is { os: OptimizedStop; stop: Stop } => !!x.stop)
    : stops.map((stop, i) => ({ os: null, stop, seq: i + 1 }));

  if (stops.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 24 }}>
        <p>No stops yet. Search an address, click the map, or load the demo route.</p>
      </div>
    );
  }

  return (
    <div>
      {displayStops.map((item) => {
        const stop = item.stop;
        const seq = 'os' in item && item.os ? item.os.sequence : (item as { seq: number }).seq;
        const window = formatWindow(stop.time_window_start, stop.time_window_end);
        return (
          <div key={stop.id} className={`stop-row ${optimizedRoute ? 'optimized' : ''}`}>
            <div className="stop-seq">{seq}</div>
            <div className="stop-info">
              <div className="stop-address">{stop.address}</div>
              <div className="stop-meta">
                {stop.priority !== 'NORMAL' && `${stop.priority} · `}
                {stop.service_duration_min}min service
                {window && ` · ${window}`}
                {item.os && ` · +${item.os.legDistanceKm.toFixed(1)}km`}
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(stop)}>
              Edit
            </button>
            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => onDelete(stop.id)}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
