import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { trpc } from "../lib/trpc";
import { useStore } from "../lib/store";
import { connectSocket } from "../lib/socket";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ToastContainer } from "./Toast";
import { FullPageLoader } from "./Loading";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, darkMode } = useStore();

  // Fetch current user on mount
  const { data: me, isLoading, isError } = trpc.auth.me.useQuery();

  useEffect(() => {
    if (me) {
      setUser(me);
      connectSocket(me.id);
    }
  }, [me, setUser]);

  useEffect(() => {
    if (isError) {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }, [isError, setUser, navigate]);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  if (isLoading && !user) return <FullPageLoader />;

  const passwordNeverChanged = user && !user.passwordChangedAt;

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        {/* Persistent security warning: default password not yet changed */}
        {passwordNeverChanged && (
          <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-1.5 text-sm text-white">
            <span>⚠️ Default password in use —</span>
            <Link
              to="/settings?tab=profile"
              className="font-semibold underline hover:no-underline"
            >
              Change it now
            </Link>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            <Outlet key={location.pathname} />
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
