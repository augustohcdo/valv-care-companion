import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  requiredType?: "medico" | "paciente";
}

export const ProtectedRoute = ({ children, requiredType }: Props) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }

  if (requiredType && profile && profile.account_type !== requiredType) {
    const correctHome = profile.account_type === "medico" ? "/app/medico" : "/app/paciente";
    return <Navigate to={correctHome} replace />;
  }

  return <>{children}</>;
};
