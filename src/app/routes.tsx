
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AcceptInvitationPage from "../features/auth/components/AcceptInvitationPage";
import LoginPage from "../features/auth/components/LoginPage";
import HomePage from "../features/auth/components/HomePage";
import ForgotPasswordPage from "../features/auth/components/ForgotPasswordPage";
import ResetPasswordPage from "../features/auth/components/ResetPasswordPage";
import ProtectedRoute from "../features/auth/components/ProtectedRoute";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/accept-invitation"
          element={<AcceptInvitationPage />}
        />

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/forgot-password"
          element={<ForgotPasswordPage />}
        />

        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
