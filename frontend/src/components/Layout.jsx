import { NavLink, Outlet } from "react-router-dom";

const linkBase = "px-3 py-2 rounded-md text-sm font-medium";
const active = "bg-gray-900 text-white";
const idle = "text-gray-700 hover:bg-gray-200";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <span className="text-lg font-bold">MediScan AI</span>
          <div className="space-x-2">
            <NavLink to="/" className={({isActive}) => `${linkBase} ${isActive?active:idle}`}>Home</NavLink>
            <NavLink to="/upload" className={({isActive}) => `${linkBase} ${isActive?active:idle}`}>Upload</NavLink>
            <NavLink to="/reports" className={({isActive}) => `${linkBase} ${isActive?active:idle}`}>Reports</NavLink>
          </div>
        </div>
      </nav>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
