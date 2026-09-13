import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router";
import { AuthProvider, RequireAuth } from "./AuthProvider";
import { AppShell } from "./AppShell";
import { SignIn } from "./SignIn";
import { Today } from "./Today";
import { Trends } from "./Trends";
import { SavedMeals } from "./SavedMeals";
import { Goals } from "./Goals";
import { Connect } from "./Connect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

export default function DashboardApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route path="signin" element={<SignIn />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route index element={<Today />} />
            <Route path="trends" element={<Trends />} />
            <Route path="meals" element={<SavedMeals />} />
            <Route path="goals" element={<Goals />} />
            <Route path="connect" element={<Connect />} />
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}
