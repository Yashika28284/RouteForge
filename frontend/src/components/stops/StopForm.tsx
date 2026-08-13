import { FormEvent, useState } from 'react';
import { geocodeAddress } from '../../api/geocode';
import type { GeocodeResult, Stop, StopInput, StopPriority } from '../../types';

interface StopFormProps {
  initial?: Stop | null;
  onSubmit: (input: StopInput) => void;
  onCancel: () => void;
  submitting?: boolean;
  atStopLimit?: boolean;
  // If a location was chosen by clicking the map, prefill lat/lng and skip search.
  presetLocation?: { lat: number; lng: number } | null;
}

export default function StopForm({ initial, onSubmit, onCancel, submitting, atStopLimit, presetLocation }: StopFormProps) {
  const [query, setQuery] = useState(initial?.address ?? '');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ lat: number; lng: number; address: string } | null>(
    initial
      ? { lat: initial.latitude, lng: initial.longitude, address: initial.address }
      : presetLocation
        ? { lat: presetLocation.lat, lng: presetLocation.lng, address: `${presetLocation.lat.toFixed(5)}, ${presetLocation.lng.toFixed(5)}` }
        : null
  );

  const [priority, setPriority] = useState<StopPriority>(initial?.priority ?? 'NORMAL');
  const [timeWindowStart, setTimeWindowStart] = useState(initial?.time_window_start?.slice(0, 5) ?? '');
  const [timeWindowEnd, setTimeWindowEnd] = useState(initial?.time_window_end?.slice(0, 5) ?? '');
  const [serviceDurationMin, setServiceDurationMin] = useState(initial?.service_duration_min ?? 5);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [customerOrderId, setCustomerOrderId] = useState(initial?.customer_order_id ?? '');

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await geocodeAddress(query);
      setResults(res);
    } finally {
      setSearching(false);
    }
  }

  function pickResult(r: GeocodeResult) {
    setSelected({ lat: r.lat, lng: r.lng, address: r.displayName });
    setQuery(r.displayName);
    setResults([]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    onSubmit({
      address: selected.address,
      latitude: selected.lat,
      longitude: selected.lng,
      priority,
      timeWindowStart: timeWindowStart || null,
      timeWindowEnd: timeWindowEnd || null,
      serviceDurationMin: Number(serviceDurationMin),
      notes: notes || null,
      customerOrderId: customerOrderId || null,
    });
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {atStopLimit && !initial && (
        <div className="error-banner">This MVP supports at most 10 stops per route.</div>
      )}

      <div className="field">
        <label htmlFor="stop-address">Address</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            id="stop-address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
            placeholder="Search for an address…"
            style={{ flex: 1 }}
          />
          <button type="button" className="btn btn-sm" onClick={runSearch} disabled={searching}>
            {searching ? '…' : 'Search'}
          </button>
        </div>
        {results.length > 0 && (
          <div className="card" style={{ marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => pickResult(r)}
                style={{ padding: 8, fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              >
                {r.displayName}
              </div>
            ))}
          </div>
        )}
        {selected && (
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
            {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="stop-priority">Priority</label>
          <select id="stop-priority" value={priority} onChange={(e) => setPriority(e.target.value as StopPriority)}>
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="stop-service">Service time (min)</label>
          <input
            id="stop-service"
            type="number"
            min={0}
            max={180}
            value={serviceDurationMin}
            onChange={(e) => setServiceDurationMin(Number(e.target.value))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="tw-start">Window start</label>
          <input id="tw-start" type="time" value={timeWindowStart} onChange={(e) => setTimeWindowStart(e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="tw-end">Window end</label>
          <input id="tw-end" type="time" value={timeWindowEnd} onChange={(e) => setTimeWindowEnd(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="stop-order-id">Customer order ID</label>
        <input id="stop-order-id" value={customerOrderId} onChange={(e) => setCustomerOrderId(e.target.value)} placeholder="Optional" />
      </div>

      <div className="field">
        <label htmlFor="stop-notes">Notes</label>
        <textarea
          id="stop-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Ring the bell, leave at gate"
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!selected || submitting || (atStopLimit && !initial)}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Add stop'}
        </button>
      </div>
    </form>
  );
}
