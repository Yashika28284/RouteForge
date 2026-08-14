import { apiRequest } from './client';
import type { GeocodeResult } from '../types';

export function geocodeAddress(query: string) {
  return apiRequest<GeocodeResult[]>(`/geocode?q=${encodeURIComponent(query)}`, { auth: false });
}
