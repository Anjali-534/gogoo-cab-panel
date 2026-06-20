'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL;
const CAB_TYPES = ['cab_2w', 'cab_3w', 'cab_4w', 'cab_4w_suv'];
const VEHICLE_LABELS: Record<string, string> = {
  cab_2w: '2 Wheeler', cab_3w: 'Auto', cab_4w: 'Mini/Sedan', cab_4w_suv: 'Prime SUV',
};
const VEHICLE_EMOJI: Record<string, string> = {
  cab_2w: '🛵', cab_3w: '🛺', cab_4w: '🚗', cab_4w_suv: '🚙',
};
const ORANGE_SHADES = ['#FFCBA4', '#FF9A5C', '#FF6B2B', '#CC4F18'];
const STATUS_COLORS: Record<string, string> = {
  completed: '#10B981', cancelled: '#EF4444', in_progress: '#FF6B2B',
  accepted: '#F59E0B', searching: '#6B7280',
};

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cab_admin_token') : '';
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}

function isCabBooking(b: BookingType) {
  return b.service_type?.category === 'cab' ||
    CAB_TYPES.includes(b.vehicle_type || '') ||
    CAB_TYPES.includes(b.service_type?.vehicle_type || '');
}

function isCabDriver(d: DriverType) {
  return CAB_TYPES.includes(d.vehicle_type || '');
}

interface BookingType {
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
}

interface DriverType {
  id: string;
  vehicle_type?: string;
  name?: string;
  phone?: string;
  status?: string;
  online?: boolean;
  is_blocked?: boolean;
  rides_today?: number;
  total_rides?: number;
  earnings_today?: number;
  rating?: number;
  vehicle_number?: string;
}

function StatCard({ icon, label, value, sub, orange }: {
  icon: string; label: string; value: string | number; sub?: string; orange?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color: orange ? '#FF6B2B' : '#0D0D0D' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function CabOverviewPage() {
  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [drivers, setDrivers] = useState<DriverType[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        fetch(`${API}/gogoo/bookings`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/drivers`, { headers: authHeaders() }),
      ]);
      const [bData, dData] = await Promise.all([bRes.json(), dRes.json()]);
      const allBookings: BookingType[] = Array.isArray(bData) ? bData : bData.data || bData.bookings || [];
      const allDrivers: DriverType[] = Array.isArray(dData) ? dData : dData.data || dData.drivers || [];
      setBookings(allBookings.filter(isCabBooking));
      setDrivers(allDrivers.filter(isCabDriver));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const today = new Date().toDateString();
  const todayBookings = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);
  const completed = todayBookings.filter(b => b.status === 'completed');
  const cancelled = todayBookings.filter(b => b.status === 'cancelled');
  const inProgress = todayBookings.filter(b => b.status === 'in_progress' || b.status === 'accepted');
  const revenue = completed.reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const onlineDrivers = drivers.filter(d => d.online || d.status === 'online');

  // Vehicle type breakdown
  const vehicleBreakdown = CAB_TYPES.map(vt => ({
    type: vt,
    label: VEHICLE_LABELS[vt],
    emoji: VEHICLE_EMOJI[vt],
    count: todayBookings.filter(b =>
      b.vehicle_type === vt || b.service_type?.vehicle_type === vt
    ).length,
    revenue: todayBookings.filter(b =>
      (b.vehicle_type === vt || b.service_type?.vehicle_type === vt) && b.status === 'completed'
    ).reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0),
  }));
  const totalVehicleCount = vehicleBreakdown.reduce((s, v) => s + v.count, 0) || 1;

  // Hourly breakdown
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    bookings: todayBookings.filter(b =>
      b.created_at && new Date(b.created_at).getHours() === h
    ).length,
  }));

  // Status pie
  const statusData = [
    { name: 'Completed', value: completed.length, color: '#10B981' },
    { name: 'Cancelled', value: cancelled.length, color: '#EF4444' },
    { name: 'In Progress', value: inProgress.length, color: '#FF6B2B' },
  ].filter(d => d.value > 0);

  // Vehicle pie
  const vehiclePie = vehicleBreakdown.map((v, i) => ({
    name: v.label, value: v.count, color: ORANGE_SHADES[i],
  })).filter(d => d.value > 0);

  // Last 7 days revenue
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const ds = d.toDateString();
    const rev = bookings
      .filter(b => b.created_at && new Date(b.created_at).toDateString() === ds && b.status === 'completed')
      .reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);
    return { day: label, revenue: rev };
  });

  // Top 5 drivers
  const topDrivers = [...drivers]
    .sort((a, b) => (b.rides_today || 0) - (a.rides_today || 0))
    .slice(0, 5);

  // Recent 10 bookings
  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 10);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-6 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-28 border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cab Operations Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Live cab data — auto-refreshes every 10s</p>
      </div>

      {/* Row 1 — Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon="🚗" label="Active Rides" value={inProgress.length} orange />
        <StatCard icon="👤" label="Drivers Online" value={onlineDrivers.length} orange />
        <StatCard icon="📋" label="Bookings Today" value={todayBookings.length} orange />
        <StatCard icon="₹" label="Revenue Today" value={`₹${revenue.toLocaleString()}`} orange />
        <StatCard icon="❌" label="Cancelled Today" value={cancelled.length} />
        <StatCard icon="⏱" label="Avg Trip Time" value="18 min" />
      </div>

      {/* Row 2 — Vehicle Type Breakdown */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {vehicleBreakdown.map((v, i) => (
          <div key={v.type} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{v.emoji}</span>
              <span className="text-sm font-semibold text-gray-700">{v.label}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: '#FF6B2B' }}>{v.count}</p>
            <p className="text-xs text-gray-500 mb-3">rides today · ₹{v.revenue.toLocaleString()}</p>
            <div className="w-full bg-orange-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.round((v.count / totalVehicleCount) * 100)}%`,
                  backgroundColor: ORANGE_SHADES[i],
                }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {Math.round((v.count / totalVehicleCount) * 100)}% of total
            </p>
          </div>
        ))}
      </div>

      {/* Row 3 — Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Cab Bookings Today by Hour</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={hourlyData}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={3} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="bookings" stroke="#FF6B2B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Vehicle Type Split</h3>
          {vehiclePie.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={vehiclePie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {vehiclePie.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Row 4 — Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#FF6B2B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Booking Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Row 5 — Recent Bookings */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Recent Cab Bookings</h3>
        </div>
        {recentBookings.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No cab bookings yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['ID', 'Vehicle', 'Rider', 'Driver', 'Route', 'Fare', 'Status', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentBookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      #{b.id?.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
                        {VEHICLE_EMOJI[b.vehicle_type || ''] || '🚗'} {VEHICLE_LABELS[b.vehicle_type || ''] || b.vehicle_type || 'Cab'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.rider?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{b.driver?.name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-32 truncate">
                      {b.pickup_address ? `${b.pickup_address?.slice(0, 18)}...` : '—'}
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
                      {b.created_at ? new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 6 — Top Drivers */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Top Performing Cab Drivers</h3>
        </div>
        {topDrivers.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No drivers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Rank', 'Driver', 'Vehicle', 'Rides Today', 'Earnings Today', 'Rating', 'Status'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {topDrivers.map((d, i) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-lg" style={{ color: i === 0 ? '#FF6B2B' : '#6B7280' }}>
                        #{i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{d.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {VEHICLE_EMOJI[d.vehicle_type || '']} {VEHICLE_LABELS[d.vehicle_type || ''] || d.vehicle_type}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#FF6B2B' }}>
                      {d.rides_today || 0}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      ₹{(d.earnings_today || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        ⭐ <span className="font-medium">{d.rating?.toFixed(1) || '—'}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`w-2 h-2 rounded-full inline-block mr-1.5 ${
                        d.online || d.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <span className="text-xs text-gray-600">
                        {d.is_blocked ? 'Blocked' : (d.online || d.status === 'online') ? 'Online' : 'Offline'}
                      </span>
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
