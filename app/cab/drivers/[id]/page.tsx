'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Star } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const CAB_TYPES = ['cab_2w', 'cab_3w', 'cab_4w', 'cab_4w_suv'];
const VEHICLE_LABELS: Record<string, string> = {
  cab_2w: '2 Wheeler', cab_3w: 'Auto', cab_4w: 'Mini/Sedan', cab_4w_suv: 'Prime SUV',
};
const VEHICLE_EMOJI: Record<string, string> = {
  cab_2w: '🛵', cab_3w: '🛺', cab_4w: '🚗', cab_4w_suv: '🚙',
};
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#FF6B2B', accepted: '#F59E0B',
};

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
  vehicle_model?: string;
  rating?: number;
  rides_today?: number;
  total_rides?: number;
  earnings_today?: number;
  total_earnings?: number;
  wallet_balance?: number;
  status?: string;
  online?: boolean;
  is_blocked?: boolean;
  docs_verified?: boolean;
  created_at?: string;
  acceptance_rate?: number;
  completion_rate?: number;
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
  distance_km?: number;
  rider?: { name?: string };
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
      <p className="text-xs text-orange-700 font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{value}</p>
      {sub && <p className="text-xs text-orange-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dRes, bRes] = await Promise.all([
        fetch(`${API}/gogoo/drivers/${id}`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/bookings?driver_id=${id}`, { headers: authHeaders() }),
      ]);
      const [dData, bData] = await Promise.all([dRes.json(), bRes.json()]);
      setDriver(dData.data || dData);
      const allBookings: Booking[] = Array.isArray(bData) ? bData : bData.data || bData.bookings || [];
      setBookings(allBookings.filter(b =>
        b.service_type?.category === 'cab' ||
        CAB_TYPES.includes(b.vehicle_type || '') ||
        CAB_TYPES.includes(b.service_type?.vehicle_type || '')
      ));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function toggleBlock() {
    if (!driver) return;
    const endpoint = driver.is_blocked ? 'unblock' : 'block';
    await fetch(`${API}/gogoo/drivers/${id}/${endpoint}`, {
      method: 'POST', headers: authHeaders(),
    });
    fetchData();
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-40 bg-white rounded-2xl border border-gray-100" />
        <div className="h-64 bg-white rounded-2xl border border-gray-100" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-xl mb-2">Driver not found</p>
        <button onClick={() => router.back()} className="text-orange-500 text-sm">Go back</button>
      </div>
    );
  }

  const today = new Date().toDateString();
  const todayRides = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const completedRides = bookings.filter(b => b.status === 'completed');
  const monthlyEarnings = completedRides.reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);

  // Rating stars
  const rating = driver.rating || 0;
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(rating));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1>
          <p className="text-sm text-gray-500">Cab Driver Profile</p>
        </div>
        <div className="ml-auto flex gap-2">
          <a href={`tel:${driver.phone}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
            <Phone size={14} /> Call
          </a>
          <button onClick={toggleBlock}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              driver.is_blocked
                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                : 'bg-red-50 text-red-600 hover:bg-red-100'
            }`}>
            {driver.is_blocked ? 'Unblock Driver' : 'Block Driver'}
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
            style={{ backgroundColor: '#FF6B2B' }}>
            {driver.name?.charAt(0) || '?'}
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Phone</p>
              <p className="font-medium text-gray-800">{driver.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Email</p>
              <p className="font-medium text-gray-800">{driver.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Vehicle Type</p>
              <span className="text-sm px-2 py-1 rounded-lg font-medium"
                style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
                {VEHICLE_EMOJI[driver.vehicle_type || '']} {VEHICLE_LABELS[driver.vehicle_type || ''] || driver.vehicle_type}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Vehicle Number</p>
              <p className="font-mono font-semibold text-gray-800">{driver.vehicle_number || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Vehicle Model</p>
              <p className="font-medium text-gray-800">{driver.vehicle_model || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  driver.is_blocked ? 'bg-red-500' :
                  driver.online || driver.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium">
                  {driver.is_blocked ? 'Blocked' : driver.online || driver.status === 'online' ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Rating</p>
              <div className="flex items-center gap-1">
                {stars.map((filled, i) => (
                  <Star key={i} size={14} fill={filled ? '#FF6B2B' : 'none'} stroke="#FF6B2B" />
                ))}
                <span className="text-sm font-bold ml-1">{rating.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Documents</p>
              <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                driver.docs_verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
              }`}>
                {driver.docs_verified ? '✓ Verified' : '⏳ Pending'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Member Since</p>
              <p className="font-medium text-gray-800">
                {driver.created_at ? new Date(driver.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Rides Today" value={todayRides.length} />
        <MetricCard label="Total Rides" value={driver.total_rides || completedRides.length} />
        <MetricCard label="Earnings Today" value={`₹${(driver.earnings_today || 0).toLocaleString()}`} />
        <MetricCard label="Wallet Balance" value={`₹${(driver.wallet_balance || 0).toLocaleString()}`} />
        <MetricCard
          label="Acceptance Rate"
          value={`${driver.acceptance_rate || '—'}%`}
          sub="Requests accepted / total"
        />
        <MetricCard
          label="Completion Rate"
          value={`${driver.completion_rate || (completedRides.length && bookings.length
            ? Math.round((completedRides.length / bookings.length) * 100) : '—')}%`}
          sub="Completed / accepted"
        />
        <MetricCard label="Monthly Earnings" value={`₹${monthlyEarnings.toLocaleString()}`} />
        <MetricCard label="Avg Rating" value={rating.toFixed(1)} sub="All-time average" />
      </div>

      {/* Cab Ride History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Cab Ride History ({bookings.length})</h3>
        </div>
        {bookings.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No cab rides found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Booking ID', 'Rider', 'Route', 'Distance', 'Fare', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.slice(0, 50).map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">#{b.id?.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-gray-700">{b.rider?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-32">
                      <p className="truncate">{b.pickup_address?.slice(0, 22) || '—'}</p>
                      <p className="text-gray-400">→ {b.drop_address?.slice(0, 22) || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.distance_km ? `${b.distance_km}km` : '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">₹{(b.final_fare || b.estimated_fare || 0).toLocaleString()}</td>
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
                      {b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
