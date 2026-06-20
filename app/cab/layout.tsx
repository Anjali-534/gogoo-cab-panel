'use client';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';
import {
  LayoutDashboard, BookOpen, Car, Layers, Clock,
  BarChart2, Settings, ExternalLink, LogOut,
} from 'lucide-react';

const NAV = [
  { href: '/cab', icon: LayoutDashboard, label: 'Overview' },
  { href: '/cab/bookings', icon: BookOpen, label: 'Bookings' },
  { href: '/cab/drivers', icon: Car, label: 'Drivers' },
  { href: '/cab/vehicles', icon: Layers, label: 'Vehicles' },
  { href: '/cab/rentals', icon: Clock, label: 'Rentals' },
  { href: '/cab/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/cab/settings', icon: Settings, label: 'Settings' },
];

export default function CabLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('cab_admin_token');
    if (!token) router.push('/');
  }, [router]);

  function logout() {
    localStorage.removeItem('cab_admin_token');
    router.push('/');
  }

  function isActive(href: string) {
    if (href === '/cab') return pathname === '/cab';
    return pathname.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Orange Sidebar */}
      <aside className="w-56 h-screen flex flex-col fixed left-0 top-0 z-30"
        style={{ backgroundColor: '#FF6B2B' }}>

        {/* Logo */}
        <div className="p-6 border-b border-orange-400">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚗</span>
            <div>
              <p className="text-white font-bold text-lg leading-tight">gogoo</p>
              <p className="text-orange-100 text-xs font-medium">Cab Operations</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.href)
                  ? 'bg-white/20 text-white font-semibold'
                  : 'text-orange-100 hover:bg-white/10 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-orange-400 space-y-2">
          <a
            href="https://gogoo-dashboard-production.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-orange-100 text-sm hover:text-white transition-colors"
          >
            <ExternalLink size={14} />
            Master Panel
          </a>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-orange-100 text-sm hover:text-white transition-colors w-full"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="ml-56 flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Cab Operations Panel</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </header>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
