import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type ProtectedRouteProps = {
  children: ReactNode;
  /** Path to redirect unauthenticated users to. Defaults to /auth. */
  redirectTo?: string;
};

/**
 * Wraps an auth-only route. While auth state is resolving, shows a brief
 * loader (no flash of redirect). When unauthenticated, redirects to
 * `redirectTo` with a `return_to` query param pointing back to the
 * originally requested location (path + search + hash).
 */
export const ProtectedRoute = ({ children, redirectTo = "/auth" }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const target = `${redirectTo}?return_to=${encodeURIComponent(returnTo)}`;
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;