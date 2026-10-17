
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { AppDevtools } from "./devtools";
import { ToastProvider } from "../components/ui";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
      <AppDevtools />
    </QueryClientProvider>
  );
}
