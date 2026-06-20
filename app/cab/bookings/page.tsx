'use client';
import { useEffect, useState, useCallback } from 'react';
import { X, Phone, XCircle } from 'lucide-react';
import Pagination from '@/components/Pagination';

const API = process.env.NEXT_PUBLIC_API_URL;
const CAB_TYPES = ['cab_2w', 'cab_3w', 'cab_4w', 'cab_4w_suv'];
const VEHICLE_LABELS: Record<string, string> = {
  cab_2w: '2W', cab_3w: 'Auto', cab_4w: 'Mini', cab_4w_suv: 'SUV',
};
const VEHICLE_EMOJI: Record<string, string> = {
  cab_2w: '🛵', cab_3w: '🛺', cab_4w: '🚗', cab_4w_suv: '🚙',
};
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#FF6B2B',
  accepted: '#F59E0B', searching: '#6B7280',
};
const RENTAL_FARES = [149, 179, 249, 299, 449, 599, 799, 999];
const PAGE_SIZE = 50;

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cab_admin_token') : '';
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

interface Booking {
  id: string;
  service_type?: { category?: string; vehicle_type?: string };
  vehicle_type?: string;
  status?: string;
  estimated_fare?: number;
  final_fare?: number;
  created_at?: string;
  rider?: { name?: string; phone?: string };
  driver?: { name?: string; phone?: string; vehicle_number?: string };
  pickup_address?: string;
  drop_address?: string;
  distance_km?: number;
  otp?: string;
  otp_verified?: boolean;
  trip_type?: string;
  rental_package?: string;
}

function isCabBooking(b: Booking) {
  return b.service_type?.category === 'cab' ||
    CAB_TYPES.includes(b.vehicle_type || '') ||
    CAB_TYPES.includes(b.service_type?.vehicle_type || '');
}

function getBookingType(b: Booking) {
  if (b.trip_type === 'outstation') return 'Outstation';
  const fare = b.estimated_fare || 0;
  if (RENTAL_FARES.includes(fare)) return 'Rental';
  if (b.rental_package) return 'Rental';
  return 'Regular';
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [selected, setSelected] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/gogoo/bookings`, { headers: authHeaders() });
      const data = await res.json();
      const all: Booking[] = Array.isArray(data) ? data : data.data || data.bookings || [];
      setBookings(all.filter(isCabBooking));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const filtered = bookings.filter(b => {
    const now = new Date();
    const created = b.created_at ? new Date(b.created_at) : null;
    if (dateFilter === 'today' && created?.toDateString() !== now.toDateString()) return false;
    if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      if (!created || created < weekAgo) return false;
    }
    if (dateFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      if (!created || created < monthAgo) return false;
    }
    if (vehicleFilter !== 'all' && b.vehicle_type !== vehicleFilter && b.service_type?.vehicle_type !== vehicleFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.id?.toLowerCase().includes(q) ||
        b.rider?.name?.toLowerCase().includes(q) ||
        b.driver?.name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const today = new Date().toDateString();
  const todayB = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const todayCompleted = todayB.filter(b => b.status === 'completed');
  const todayCancelled = todayB.filter(b => b.status === 'cancelled');
  const todayRevenue = todayCompleted.reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const avgFare = todayCompleted.length ? Math.round(todayRevenue / todayCompleted.length) : 0;

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
        <h1 className="text-2xl font-bold text-gray-900">Cab Bookings</h1>
        <p className="text-sm text-gray-500 mt-0.5">All cab bookings filtered from backend</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Today', value: todayB.length },
          { label: 'Completed', value: todayCompleted.length },
          { label: 'Cancelled', value: todayCancelled.length },
          { label: 'Revenue Today', value: `₹${todayRevenue.toLocaleString()}` },
          { label: 'Avg Fare', value: `₹${avgFare}` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by ID, rider, or driver..."
            className="flex-1 min-w-48 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400"
          />
          <select value={vehicleFilter} onChange={e => { setVehicleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400">
            <option value="all">All Vehicles</option>
            <option value="cab_2w">2 Wheeler</option>
            <option value="cab_3w">Auto</option>
            <option value="cab_4w">Mini/Sedan</option>
            <option value="cab_4w_suv">SUV</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400">
            <option value="all">All Status</option>
            <option value="searching">Searching</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={dateFilter} onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-orange-400">
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">{filtered.length} bookings</p>
        </div>
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">No bookings found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Booking ID', 'Vehicle', 'Rider', 'Driver', 'Route', 'Dist', 'Fare', 'Type', 'Status', 'Time', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
                        {VEHICLE_EMOJI[b.vehicle_type || '']} {VEHICLE_LABELS[b.vehicle_type || ''] || 'Cab'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.rider?.name || '—'}</p>
                      <p className="text-xs text-gray-400">{b.rider?.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{b.driver?.name || 'Unassigned'}</p>
                      <p className="text-xs text-gray-400">{b.driver?.vehicle_number || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-32">
                      <p className="truncate">{b.pickup_address?.slice(0, 20) || '—'}</p>
                      <p className="text-gray-400 truncate">→ {b.drop_address?.slice(0, 20) || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km}km` : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">
                        {getBookingType(b)}
                      </span>
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
                      {b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(b)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
                        View
                      </button>
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

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-96 bg-white h-full overflow-y-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">Booking Detail</h2>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs text-gray-400 mb-1">Booking ID</p>
                <p className="font-mono font-semibold">{selected.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Vehicle</p>
                  <p className="font-medium">{VEHICLE_EMOJI[selected.vehicle_type || '']} {VEHICLE_LABELS[selected.vehicle_type || ''] || selected.vehicle_type || 'Cab'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Type</p>
                  <p className="font-medium">{getBookingType(selected)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Status</p>
                <span className="text-sm px-3 py-1 rounded-full font-medium capitalize"
                  style={{
                    backgroundColor: `${STATUS_COLORS[selected.status || ''] || '#6B7280'}20`,
                    color: STATUS_COLORS[selected.status || ''] || '#6B7280',
                  }}>
                  {selected.status?.replace('_', ' ') || 'unknown'}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-2">Rider</p>
                <p className="font-medium">{selected.rider?.name || '—'}</p>
                {selected.rider?.phone && (
                  <a href={`tel:${selected.rider.phone}`} className="flex items-center gap-1 text-xs text-orange-500 mt-1">
                    <Phone size={12} /> {selected.rider.phone}
                  </a>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-2">Driver</p>
                <p className="font-medium">{selected.driver?.name || 'Unassigned'}</p>
                {selected.driver?.phone && (
                  <a href={`tel:${selected.driver.phone}`} className="flex items-center gap-1 text-xs text-orange-500 mt-1">
                    <Phone size={12} /> {selected.driver.phone}
                  </a>
                )}
                {selected.driver?.vehicle_number && (
                  <p className="text-xs text-gray-500 mt-1">{selected.driver.vehicle_number}</p>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-2">Route</p>
                <p className="text-sm text-gray-700">📍 {selected.pickup_address || '—'}</p>
                <p className="text-sm text-gray-500 mt-1">→ {selected.drop_address || '—'}</p>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-2">Fare Breakdown</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estimated Fare</span>
                    <span>₹{selected.estimated_fare || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-700">Final Fare</span>
                    <span style={{ color: '#FF6B2B' }}>₹{selected.final_fare || selected.estimated_fare || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
                    <span>gogoo Commission (20%)</span>
                    <span>₹{Math.round((selected.final_fare || selected.estimated_fare || 0) * 0.2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Driver Earnings (80%)</span>
                    <span>₹{Math.round((selected.final_fare || selected.estimated_fare || 0) * 0.8)}</span>
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400 mb-2">OTP</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-lg">{selected.otp || '—'}</span>
                  <span className="text-xs">
                    {selected.otp_verified ? '✅ Verified' : '⏳ Pending'}
                  </span>
                </div>
              </div>
              {selected.status !== 'cancelled' && selected.status !== 'completed' && (
                <div className="border-t border-gray-100 pt-4">
                  <button className="w-full py-2.5 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 transition-colors">
                    <XCircle size={16} />
                    Cancel Booking
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
