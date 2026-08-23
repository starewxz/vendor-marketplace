import { apiClient } from './client';
import type { AuthResponse } from '../types/user';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
  return data;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', input);
  return data;
}

/** Reads the httpOnly refresh cookie server-side; used both for token rotation and session restoration on load. */
export async function refresh(): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/refresh');
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}
