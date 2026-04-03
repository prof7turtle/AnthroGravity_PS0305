import React from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRole?: 'user' | 'merchant';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRole }) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user?.role !== allowedRole) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-180px)] w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="w-full rounded-2xl border border-[#a855f7]/25 bg-[#141418]/90 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <h2 className="mb-3 font-['Outfit'] text-3xl font-extrabold text-white">Access Restricted</h2>
          <p className="mb-6 text-sm leading-relaxed text-[#8a8a98]">
            This page is available only for merchant accounts. You are currently signed in as a user account.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/marketplace"
              className="rounded-lg border border-[#a855f7]/30 bg-linear-to-br from-[#a855f7] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_8px_25px_rgba(168,85,247,0.35)]"
            >
              Go To Marketplace
            </Link>
            <Link
              to="/workflows"
              className="rounded-lg border border-white/20 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:border-white/35 hover:bg-white/10"
            >
              Open Workflows
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
