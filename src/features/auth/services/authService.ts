
import { apiClient } from "../../../lib/axios";
import type {
  AcceptInvitationRequest,
  AcceptInvitationResponse,
} from "../types/invitation";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
}

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string;
  role_id: string;
  role: "admin" | "hiring_manager" | "recruiter";
  contact: string | null;
  location: string | null;
  status: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export interface ProfileUpdate {
  name: string | null;
  contact: string | null;
  location: string | null;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export async function acceptInvitation(
  payload: AcceptInvitationRequest,
): Promise<AcceptInvitationResponse> {
  const response = await apiClient.post<AcceptInvitationResponse>(
    "/api/v1/auth/accept-invitation",
    payload,
  );
  return response.data;
}

export async function login(
  payload: LoginRequest,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    "/api/v1/auth/login",
    payload,
  );
  return response.data;
}

/** Admins sign in through their own endpoint; it refuses everyone else. */
export async function adminLogin(
  payload: LoginRequest,
): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>(
    "/api/v1/internal/login",
    payload,
  );
  return response.data;
}

export async function updateProfile(
  payload: ProfileUpdate,
): Promise<CurrentUser> {
  const response = await apiClient.patch<CurrentUser>(
    "/api/v1/auth/me",
    payload,
  );
  return response.data;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>(
    "/api/v1/auth/me",
  );
  return response.data;
}

export async function refreshAccessToken(): Promise<void> {
  await apiClient.post("/api/v1/auth/refresh", null);
}

export async function logout(): Promise<void> {
  await apiClient.post("/api/v1/auth/logout", null);
}

export async function forgotPassword(
  payload: ForgotPasswordRequest,
): Promise<ForgotPasswordResponse> {
  const response = await apiClient.post<ForgotPasswordResponse>(
    "/api/v1/auth/forgot-password",
    payload,
  );
  return response.data;
}

export async function resetPassword(
  payload: ResetPasswordRequest,
): Promise<ResetPasswordResponse> {
  const response = await apiClient.post<ResetPasswordResponse>(
    "/api/v1/auth/reset-password",
    payload,
  );
  return response.data;
}
