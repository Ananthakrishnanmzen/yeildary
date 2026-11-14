import { Loader2 } from 'lucide-react';
import AuthPage from './components/AuthPage';
import FarmerDashboard from './components/FarmerDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const { isInitializing, isAuthenticated } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#07090D] flex flex-col items-center justify-center gap-3 text-slate-300">
        <Loader2 className="w-7 h-7 animate-spin text-[#84CC16]" />
        <p className="text-xs font-medium tracking-wide uppercase text-slate-400">
          Restoring Farmer Session...
        </p>
      </div>
    );
  }

  return isAuthenticated ? <FarmerDashboard /> : <AuthPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
