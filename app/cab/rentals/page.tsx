'use client';
import { useEffect, useState, useCallback } from 'react';
import Pagination from '@/components/Pagination';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const CAB_TYPES = ['cab_2w', 'cab_3w', 'cab_4w', 'cab_4w_suv'];
const VEHICLE_LABELS: Record<string, string> = {
  cab_2w: '2W', cab_3w: 'Auto', cab_4w: 'Mini', cab_4w_suv: 'SUV',
};
const VEHICLE_EMOJI: Record<string, string> = {
  cab_2w: '🛵', cab_3w: '🛺', cab_4w: '🚗', cab_4w_suv: '🚙',
};
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#FF6B2B', accepted: '#F59E0B',
};

const PACKAGES = [
  { label: '1hr/10km', fare: 149 },
  { label: '1hr/15km', fare: 179 },
  { label: '2hr/20km', fare: 249 },
  { label: '2hr/25km', fare: 299 },
  { label: '3hr/30km', fare: 449 },
  { label: '4hr/40km', fare: 599 },
  { label: '6hr/60km', fare: 799 },
  { label: '8hr/80km', fare: 999 },
];
const RENTAL_FARES = PACKAGES.map(p => p.fare);
const PAGE_SIZE = 50;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cab_admin_token') : '';
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

interface Booking {
  id: string;
  vehicle_type?: string;
  service_type?: { category?: string; vehicle_type?: string };
  status?: string;
  estimated_fare?: number;
  final_fare?: number;
  created_at?: string;
  pickup_address?: string;
  drop_address?: string;
  rider?: { name?: string; phone?: string };
  driver?: { name?: string; phone?: string; vehicle_number?: string };
  rental_package?: string;
  trip_type?: string;
}

function isRental(b: Booking) {
  if (b.trip_type === 'rental') return true;
  if (b.rental_package) return true;
  const fare = b.estimated_fare || 0;
  return RENTAL_FARES.includes(fare);
}

function isCabBooking(b: Booking) {
  return b.service_type?.category === 'cab' ||
    CAB_TYPES.includes(b.vehicle_type || '') ||
    CAB_TYPES.includes(b.service_type?.vehicle_type || '');
}

function getPackageLabel(b: Booking) {
  if (b.rental_package) return b.rental_package;
  const fare = b.estimated_fare || 0;
  const pkg = PACKAGES.find(p => p.fare === fare);
  return pkg ? `${pkg.label} — ₹${pkg.fare}` : `₹${fare}`;
}

export default function RentalsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API}/gogoo/bookings`, { headers: authHeaders() });
      const data = await res.json();
      const all: Booking[] = Array.isArray(data) ? data : data.data || data.bookings || [];
      setBookings(all.filter(b => isCabBooking(b) && isRental(b)));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toDateString();
  const todayRentals = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const todayRevenue = todayRentals.filter(b => b.status === 'completed')
    .reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);

  // Package stats
  const packageStats = PACKAGES.map(pkg => {
    const matches = bookings.filter(b => {
      if (b.rental_package === pkg.label) return true;
      return b.estimated_fare === pkg.fare;
    });
    const todayMatches = matches.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
    return {
      ...pkg,
      count: matches.length,
      todayCount: todayMatches.length,
      revenue: matches.filter(b => b.status === 'completed')
        .reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0),
    };
  });

  const mostPopular = [...packageStats].sort((a, b) => b.count - a.count)[0];

  const avgDuration = '2.4 hr'; // derived from rental packages

  const paginated = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-white rounded-2xl border border-gray-100" />
        <div className="h-48 bg-white rounded-2xl border border-gray-100" />
        <div className="h-96 bg-white rounded-2xl border border-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hourly Rentals</h1>
        <p className="text-sm text-gray-500 mt-0.5">All cab rental bookings by package</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Total Rentals Today</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{todayRentals.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Revenue Today</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#FF6B2B' }}>₹{todayRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Most Popular Package</p>
          <p className="text-lg font-bold mt-1 text-gray-900">{mostPopular?.label || '—'}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-500">Avg Duration</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{avgDuration}</p>
        </div>
      </div>

      {/* Package Cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Package Performance</h2>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {packageStats.map(pkg => (
            <div key={pkg.fare}
              className={`bg-white rounded-2xl p-5 border shadow-sm relative ${
                pkg.label === mostPopular?.label ? 'border-orange-300' : 'border-gray-100'
              }`}>
              {pkg.label === mostPopular?.label && (
                <span className="absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-semibold text-white"
                  style={{ backgroundColor: '#FF6B2B' }}>
                  ⭐ Popular
                </span>
              )}
              <div className="mb-3">
                <p className="font-bold text-gray-900">{pkg.label}</p>
                <p className="text-lg font-bold" style={{ color: '#FF6B2B' }}>₹{pkg.fare}</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bookings</span>
                  <span className="font-semibold text-gray-800">{pkg.count}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Today</span>
                  <span className="font-semibold" style={{ color: '#FF6B2B' }}>{pkg.todayCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Revenue</span>
                  <span className="font-semibold text-gray-800">₹{pkg.revenue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rentals Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">{bookings.length} total rental bookings</p>
        </div>
        {bookings.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">No rental bookings found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Booking ID', 'Rider', 'Package', 'Vehicle', 'Driver', 'Pickup', 'Fare', 'Status', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.rider?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{b.rider?.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
                        {getPackageLabel(b)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {VEHICLE_EMOJI[b.vehicle_type || '']} {VEHICLE_LABELS[b.vehicle_type || ''] || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.driver?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">
                      {b.pickup_address?.slice(0, 25) || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      ₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                        style={{
                          backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`,
                          color: STATUS_COLORS[b.status || ''] || '#6B7280',
                        }}>
                        {b.status?.replace('_', ' ') || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {b.created_at ? new Date(b.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="p-4 border-t border-gray-100">
          <Pagination page={page} total={bookings.length} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      </div>
    </div>
  );
}
