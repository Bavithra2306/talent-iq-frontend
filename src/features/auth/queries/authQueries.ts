
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { acceptInvitation } from "../services/authService";
import type { AcceptInvitationRequest } from "../types/invitation";

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (payload: AcceptInvitationRequest) =>
      acceptInvitation(payload),
    onError: (error) => {
      if (axios.isAxiosError(error)) {
        console.error(
          "Invitation acceptance failed:",
          error.response?.status,
        );
      }
    },
  });
}
