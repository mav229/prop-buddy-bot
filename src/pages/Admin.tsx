import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Loader2 } from "lucide-react";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass-panel p-8 text-center max-w-md">
          <h1 className="font-display text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have admin permissions. Contact the administrator to get access.
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-primary hover:underline"
          >
            Return to Chat
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
};

export default Admin;
