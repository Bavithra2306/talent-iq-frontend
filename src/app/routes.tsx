
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import AcceptInvitationPage from "../features/auth/components/AcceptInvitationPage";
import LoginPage from "../features/auth/components/LoginPage";
import ForgotPasswordPage from "../features/auth/components/ForgotPasswordPage";
import ResetPasswordPage from "../features/auth/components/ResetPasswordPage";
import Layout from "../components/Layout";
import { RequireRole, SessionProvider } from "./session";
import DashboardPage from "../features/dashboard/DashboardPage";
import JobsPage from "../features/jobs/JobsPage";
import JobNewPage from "../features/jobs/JobNewPage";
import JobDetailPage from "../features/jobs/JobDetailPage";
import CandidatesPage from "../features/candidates/CandidatesPage";
import SourcingPage from "../features/sourcing/SourcingPage";
import ShortlistsPage from "../features/shortlist/ShortlistsPage";
import JobShortlistPage from "../features/shortlist/JobShortlistPage";
import ReviewPage from "../features/review/ReviewPage";
import LogsPage from "../features/logs/LogsPage";
import TeamPage from "../features/team/TeamPage";
import ProfilePage from "../features/profile/ProfilePage";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin/login" element={<LoginPage admin />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<SessionProvider><Layout /></SessionProvider>}>
          <Route index element={<DashboardPage />} />
          <Route path="jobs" element={<RequireRole roles={["recruiter", "hiring_manager"]}><JobsPage /></RequireRole>} />
          <Route path="jobs/new" element={<RequireRole roles={["recruiter", "hiring_manager"]}><JobNewPage /></RequireRole>} />
          <Route path="jobs/:id" element={<RequireRole roles={["recruiter", "hiring_manager"]}><JobDetailPage /></RequireRole>} />
          <Route path="jobs/:id/shortlist" element={<RequireRole roles={["recruiter"]}><JobShortlistPage /></RequireRole>} />
          <Route path="candidates" element={<RequireRole roles={["recruiter"]}><CandidatesPage /></RequireRole>} />
          <Route path="sourcing" element={<RequireRole roles={["recruiter"]}><SourcingPage /></RequireRole>} />
          <Route path="shortlists" element={<RequireRole roles={["recruiter"]}><ShortlistsPage /></RequireRole>} />
          <Route path="review" element={<RequireRole roles={["hiring_manager"]}><ReviewPage /></RequireRole>} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="team" element={<RequireRole roles={["admin"]}><TeamPage /></RequireRole>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
