import { apiRequest } from './client';
import type { User } from '../types';

interface AuthResponse {
  user: User;
  accessToken: string;
}

export function registerUser(email: string, password: string) {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function loginUser(email: string, password: string) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function logoutUser() {
  return apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
}
