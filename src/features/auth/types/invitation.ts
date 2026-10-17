
export interface AcceptInvitationRequest {
  token: string;
  password: string;
  confirm_password: string;
}

export interface AcceptInvitationResponse {
  message: string;
}
