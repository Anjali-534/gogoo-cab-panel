'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL;
const VEHICLE_TYPES = [
  { key: 'cab_2w', label: '2 Wheeler', emoji: '🛵', color: '#FFCBA4' },
  { key: 'cab_3w', label: 'Auto', emoji: '🛺', color: '#FF9A5C' },
  { key: 'cab_4w', label: 'Mini/Sedan', emoji: '🚗', color: '#FF6B2B' },
  { key: 'cab_4w_suv', label: 'Prime SUV', emoji: '🚙', color: '#CC4F18' },
];
const CAB_TYPES = VEHICLE_TYPES.map(v => v.key);

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
  distance_km?: number;
  driver?: { name?: string; rating?: number };
}
interface Driver {
  id: string;
  vehicle_type?: string;
  online?: boolean;
  status?: string;
  name?: string;
  rating?: number;
  rides_today?: number;
  earnings_today?: number;
}

function isCabBooking(b: Booking) {
  return b.service_type?.category === 'cab' ||
    CAB_TYPES.includes(b.vehicle_type || '') ||
    CAB_TYPES.includes(b.service_type?.vehicle_type || '');
}

export default function VehiclesPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [bRes, dRes] = await Promise.all([
        fetch(`${API}/gogoo/bookings`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/drivers`, { headers: authHeaders() }),
      ]);
      const [bData, dData] = await Promise.all([bRes.json(), dRes.json()]);
      const allB: Booking[] = Array.isArray(bData) ? bData : bData.data || bData.bookings || [];
      const allD: Driver[] = Array.isArray(dData) ? dData : dData.data || dData.drivers || [];
      setBookings(allB.filter(isCabBooking));
      setDrivers(allD.filter(d => CAB_TYPES.includes(d.vehicle_type || '')));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toDateString();
  const todayB = bookings.filter(b => b.created_at && new Date(b.created_at).toDateString() === today);

  const vStats = VEHICLE_TYPES.map(vt => {
    const allVtB = bookings.filter(b => b.vehicle_type === vt.key || b.service_type?.vehicle_type === vt.key);
    const todayVtB = todayB.filter(b => b.vehicle_type === vt.key || b.service_type?.vehicle_type === vt.key);
    const completed = allVtB.filter(b => b.status === 'completed');
    const todayCompleted = todayVtB.filter(b => b.status === 'completed');
    const cancelled = allVtB.filter(b => b.status === 'cancelled');
    const onlineDrivers = drivers.filter(d => d.vehicle_type === vt.key && (d.online || d.status === 'online'));
    const topDriver = drivers.filter(d => d.vehicle_type === vt.key).sort((a, b) => (b.rides_today || 0) - (a.rides_today || 0))[0];
    const avgFare = completed.length ? Math.round(completed.reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0) / completed.length) : 0;
    const avgDist = completed.length ? (completed.reduce((s, b) => s + (b.distance_km || 0), 0) / completed.length).toFixed(1) : '0';
    const avgRating = drivers.filter(d => d.vehicle_type === vt.key && d.rating).reduce((s, d, _, a) => s + (d.rating || 0) / a.length, 0);

    return {
      ...vt,
      ridesToday: todayVtB.length,
      revToday: todayCompleted.reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0),
      driversOnline: onlineDrivers.length,
      avgFare,
      avgDist,
      totalB: allVtB.length,
      completionRate: allVtB.length ? Math.round((completed.length / allVtB.length) * 100) : 0,
      cancellationRate: allVtB.length ? Math.round((cancelled.length / allVtB.length) * 100) : 0,
      avgRating: avgRating.toFixed(1),
      topDriver: topDriver?.name || '—',
      weekB: (() => {
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
        return allVtB.filter(b => b.created_at && new Date(b.created_at) >= weekAgo).length;
      })(),
      monthB: (() => {
        const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
        return allVtB.filter(b => b.created_at && new Date(b.created_at) >= monthAgo).length;
      })(),
    };
  });

  // Last 7 days rides per vehicle
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const ds = d.toDateString();
    const row: Record<string, string | number> = { day: label };
    VEHICLE_TYPES.forEach(vt => {
      row[vt.label] = bookings.filter(b =>
        (b.vehicle_type === vt.key || b.service_type?.vehicle_type === vt.key) &&
        b.created_at && new Date(b.created_at).toDateString() === ds
      ).length;
    });
    return row;
  });

  const last7Rev = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-US', { weekday: 'short' });
    const ds = d.toDateString();
    const row: Record<string, string | number> = { day: label };
    VEHICLE_TYPES.forEach(vt => {
      row[vt.label] = bookings.filter(b =>
        (b.vehicle_type === vt.key || b.service_type?.vehicle_type === vt.key) &&
        b.created_at && new Date(b.created_at).toDateString() === ds &&
        b.status === 'completed'
      ).reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);
    });
    return row;
  });

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-40 bg-white rounded-2xl border border-gray-100" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vehicle Performance</h1>
        <p className="text-sm text-gray-500 mt-0.5">Breakdown by cab vehicle type</p>
      </div>

      {/* 4 Vehicle Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {vStats.map(v => (
          <div key={v.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-4xl">{v.emoji}</span>
              <div>
                <p className="font-bold text-gray-900">{v.label}</p>
                <p className="text-xs text-gray-400">{v.driversOnline} online</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Rides Today</span>
                <span className="font-bold" style={{ color: '#FF6B2B' }}>{v.ridesToday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Revenue Today</span>
                <span className="font-semibold text-gray-800">₹{v.revToday.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Avg Fare</span>
                <span className="text-gray-700">₹{v.avgFare}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Avg Dist</span>
                <span className="text-gray-700">{v.avgDist} km</span>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">Top Driver Today</p>
                <p className="text-sm font-medium text-gray-700 mt-0.5">{v.topDriver}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Vehicle Type Comparison</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Metric</th>
                {VEHICLE_TYPES.map(v => (
                  <th key={v.key} className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: v.color }}>
                    {v.emoji} {v.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { label: 'Bookings Today', key: 'ridesToday' },
                { label: 'Bookings This Week', key: 'weekB' },
                { label: 'Bookings This Month', key: 'monthB' },
                { label: 'Completion Rate', key: 'completionRate', suffix: '%' },
                { label: 'Cancellation Rate', key: 'cancellationRate', suffix: '%' },
                { label: 'Average Fare', key: 'avgFare', prefix: '₹' },
                { label: 'Avg Trip Distance', key: 'avgDist', suffix: ' km' },
                { label: 'Avg Driver Rating', key: 'avgRating' },
              ].map(row => (
                <tr key={row.label} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600 font-medium">{row.label}</td>
                  {vStats.map(v => (
                    <td key={v.key} className="px-4 py-3 text-center font-semibold text-gray-800">
                      {row.prefix || ''}{(v as Record<string, unknown>)[row.key] as string}{row.suffix || ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Rides by Vehicle Type (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7Days}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {VEHICLE_TYPES.map(v => (
                <Bar key={v.key} dataKey={v.label} fill={v.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Vehicle Type (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={last7Rev}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />
              <Legend />
              {VEHICLE_TYPES.map(v => (
                <Bar key={v.key} dataKey={v.label} fill={v.color} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
