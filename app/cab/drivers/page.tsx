'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ShieldOff, Bell } from 'lucide-react';
import Pagination from '@/components/Pagination';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const CAB_TYPES = ['cab_2w', 'cab_3w', 'cab_4w', 'cab_4w_suv'];
const VEHICLE_LABELS: Record<string, string> = {
  cab_2w: '2 Wheeler', cab_3w: 'Auto', cab_4w: 'Mini/Sedan', cab_4w_suv: 'Prime SUV',
};
const VEHICLE_EMOJI: Record<string, string> = {
  cab_2w: '🛵', cab_3w: '🛺', cab_4w: '🚗', cab_4w_suv: '🚙',
};
const PAGE_SIZE = 50;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cab_admin_token') : '';
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

interface Driver {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  rating?: number;
  rides_today?: number;
  total_rides?: number;
  earnings_today?: number;
  wallet_balance?: number;
  status?: string;
  is_online?: boolean;
  is_blocked?: boolean;
  is_verified?: boolean;
  profile_photo?: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [page, setPage] = useState(1);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/gogoo/drivers`, { headers: authHeaders() });
      const data = await res.json();
      const all: Driver[] = Array.isArray(data) ? data : data.data || data.drivers || [];
      setDrivers(all.filter(d => CAB_TYPES.includes(d.vehicle_type || '')));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  async function toggleBlock(driver: Driver) {
    const endpoint = driver.is_blocked ? 'unblock' : 'block';
    try {
      await fetch(`${API}/gogoo/drivers/${driver.id}/${endpoint}`, {
        method: 'POST', headers: authHeaders(),
      });
      fetchDrivers();
    } catch {
      // silent
    }
  }

  const filtered = drivers.filter(d => {
    if (vehicleFilter !== 'all' && d.vehicle_type !== vehicleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        d.name?.toLowerCase().includes(q) ||
        d.phone?.toLowerCase().includes(q) ||
        d.vehicle_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: drivers.length,
    online: drivers.filter(d => d.is_online).length,
    offline: drivers.filter(d => !d.is_online && !d.is_blocked).length,
    blocked: drivers.filter(d => d.is_blocked).length,
    pendingDocs: drivers.filter(d => !d.is_verified).length,
  };

  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'cab_2w', label: '2 Wheeler' },
    { key: 'cab_3w', label: 'Auto' },
    { key: 'cab_4w', label: 'Mini/Sedan' },
    { key: 'cab_4w_suv', label: 'SUV' },
  ];

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-100" />
        <div className="h-96 bg-white rounded-2xl border border-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cab Drivers</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage all cab drivers across vehicle types</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Cab Drivers', value: stats.total },
          { label: 'Online', value: stats.online, color: '#10B981' },
          { label: 'Offline', value: stats.offline, color: '#6B7280' },
          { label: 'Blocked', value: stats.blocked, color: '#EF4444' },
          { label: 'Pending Docs', value: stats.pendingDocs, color: '#F59E0B' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: s.color || '#FF6B2B' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex flex-wrap border-b border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setVehicleFilter(tab.key); setPage(1); }}
              className={`px-5 py-3.5 text-sm font-medium transition-colors ${
                vehicleFilter === tab.key
                  ? 'border-b-2 text-orange-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              style={vehicleFilter === tab.key ? { borderBottomColor: '#FF6B2B' } : {}}
            >
              {tab.label}
            </button>
          ))}
          <div className="flex-1 flex items-center justify-end px-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search drivers..."
                className="pl-8 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400 w-56"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">No drivers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Driver', 'Phone', 'Vehicle Type', 'Vehicle No.', 'Rating', 'Rides Today', 'Total', 'Earnings Today', 'Wallet', 'Status', 'Docs', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: '#FF6B2B' }}>
                          {d.name?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium text-gray-800">{d.name || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
                        {VEHICLE_EMOJI[d.vehicle_type || '']} {VEHICLE_LABELS[d.vehicle_type || ''] || d.vehicle_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{d.vehicle_number || '—'}</td>
                    <td className="px-4 py-3">⭐ {d.rating?.toFixed(1) || '—'}</td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#FF6B2B' }}>{d.rides_today || 0}</td>
                    <td className="px-4 py-3 text-gray-600">{d.total_rides || 0}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₹{(d.earnings_today || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">₹{(d.wallet_balance || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {d.is_blocked ? (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <span className="w-2 h-2 bg-red-500 rounded-full" /> Blocked
                        </span>
                      ) : d.is_online ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="w-2 h-2 bg-green-500 rounded-full" /> Online
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <span className="w-2 h-2 bg-gray-400 rounded-full" /> Offline
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        d.is_verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                      }`}>
                        {d.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/cab/drivers/${d.id}`}
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-500 transition-colors" title="View Profile">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        </Link>
                        <button onClick={() => toggleBlock(d)}
                          className={`p-1.5 rounded-lg transition-colors ${d.is_blocked ? 'hover:bg-green-50 text-green-600' : 'hover:bg-red-50 text-red-500'}`}
                          title={d.is_blocked ? 'Unblock' : 'Block'}>
                          <ShieldOff size={14} />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors" title="Send Notification">
                          <Bell size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-gray-100">
          <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
