import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { MotionConfig } from "motion/react";
import "./index.css";
import { Landing } from "./landing/Landing";

// The dashboard (and supabase-js with it) is split into its own chunk, so the
// landing page stays light for first-time visitors.
const DashboardApp = lazy(() => import("./app/DashboardApp"));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route
            path="/app/*"
            element={
              <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
                <DashboardApp />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>
);
