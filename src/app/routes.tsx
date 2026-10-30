
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";

import DashboardLayout from "../layouts/DashboardLayout";
import { AcceptInvitationPage, ForgotPasswordPage, LoginPage, ResetPasswordPage } from "../features/auth";
import { ResumesPage } from "../features/candidates";
import { DashboardPage } from "../features/dashboard";
import { JobDetailPage, JobNewPage, JobsPage } from "../features/jobs";
import { LogsPage } from "../features/logs";
import { ProfilePage } from "../features/profile";
import { ReviewPage } from "../features/review";
import { SourcingPage } from "../features/sourcing";
import { TeamPage } from "../features/team";
import { RequireRole, SessionProvider } from "./session";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/internal" element={<LoginPage admin />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<SessionProvider><DashboardLayout /></SessionProvider>}>
          <Route index element={<DashboardPage />} />
          <Route path="jobs" element={<RequireRole roles={["recruiter", "hiring_manager"]}><JobsPage /></RequireRole>} />
          <Route path="jobs/new" element={<RequireRole roles={["recruiter", "hiring_manager"]}><JobNewPage /></RequireRole>} />
          <Route path="jobs/:id" element={<RequireRole roles={["recruiter", "hiring_manager"]}><JobDetailPage /></RequireRole>} />
          <Route path="jobs/:id/shortlist" element={<JobShortlistRedirect />} />
          <Route path="resumes" element={<RequireRole roles={["recruiter"]}><ResumesPage /></RequireRole>} />
          <Route path="candidates" element={<Navigate to="/resumes" replace />} />
          <Route path="sourcing" element={<RequireRole roles={["recruiter"]}><SourcingPage /></RequireRole>} />
          <Route path="shortlists" element={<Navigate to="/jobs" replace />} />
          <Route path="review" element={<RequireRole roles={["hiring_manager"]}><ReviewPage /></RequireRole>} />
          <Route path="logs" element={<RequireRole roles={["recruiter", "admin"]}><LogsPage /></RequireRole>} />
          <Route path="team" element={<RequireRole roles={["admin"]}><TeamPage /></RequireRole>} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

/** Old matching links (/jobs/:id/shortlist) now open the job page, where matching happens. */
function JobShortlistRedirect() {
  const { id = "" } = useParams();
  return <Navigate to={`/jobs/${id}#matching`} replace />;
}
