import L from 'leaflet';
import { useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import type { OptimizedStop, Stop } from '../../types';

interface RouteMapProps {
  depot: { lat: number; lng: number; address?: string | null } | null;
  stops: Stop[];
  optimizedRoute: OptimizedStop[] | null;
  onMapClick: (lat: number, lng: number) => void;
  onStopDragEnd: (stopId: string, lat: number, lng: number) => void;
}

function pinIcon(label: string, isDepot: boolean) {
  return L.divIcon({
    className: '',
    html: `<div class="route-marker-pin${isDepot ? ' depot' : ''}"><span>${label}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function RouteMap({ depot, stops, optimizedRoute, onMapClick, onStopDragEnd }: RouteMapProps) {
  const center: [number, number] = depot
    ? [depot.lat, depot.lng]
    : stops.length > 0
      ? [stops[0].latitude, stops[0].longitude]
      : [28.6139, 77.209]; // Delhi fallback so the map isn't centered on the ocean

  // Prefer the optimized sequence for the drawn path/order labels once we
  // have one; otherwise show stops in their current (unoptimized) order.
  const sequenceLabels = useMemo(() => {
    const map = new Map<string, number>();
    if (optimizedRoute) {
      optimizedRoute.forEach((s) => map.set(s.stopId, s.sequence));
    } else {
      stops.forEach((s, i) => map.set(s.id, i + 1));
    }
    return map;
  }, [optimizedRoute, stops]);

  const polylinePositions: [number, number][] = useMemo(() => {
    if (optimizedRoute && depot) {
      return [
        [depot.lat, depot.lng],
        ...optimizedRoute.map((s) => [s.latitude, s.longitude] as [number, number]),
        [depot.lat, depot.lng],
      ];
    }
    return [];
  }, [optimizedRoute, depot]);

  return (
    <MapContainer center={center} zoom={12} className="leaflet-container" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />

      {polylinePositions.length > 0 && (
        <Polyline positions={polylinePositions} pathOptions={{ color: '#ff8a34', weight: 3, opacity: 0.85 }} />
      )}

      {depot && (
        <Marker position={[depot.lat, depot.lng]} icon={pinIcon('D', true)} />
      )}

      {stops.map((stop) => (
        <Marker
          key={stop.id}
          position={[stop.latitude, stop.longitude]}
          icon={pinIcon(String(sequenceLabels.get(stop.id) ?? '?'), false)}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const latlng = e.target.getLatLng();
              onStopDragEnd(stop.id, latlng.lat, latlng.lng);
            },
          }}
        />
      ))}
    </MapContainer>
  );
}
