'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';
const CAB_TYPES = ['cab_2w', 'cab_3w', 'cab_4w', 'cab_4w_suv'];
const VEHICLE_LABELS: Record<string, string> = {
  cab_2w: '2W', cab_3w: 'Auto', cab_4w: 'Mini', cab_4w_suv: 'SUV',
};
const ORANGE_SHADES = ['#FFCBA4', '#FF9A5C', '#FF6B2B', '#CC4F18'];
const RENTAL_FARES = [149, 179, 249, 299, 449, 599, 799, 999];
const PACKAGES = [
  { label: '1hr/10km', fare: 149 }, { label: '1hr/15km', fare: 179 },
  { label: '2hr/20km', fare: 249 }, { label: '2hr/25km', fare: 299 },
  { label: '3hr/30km', fare: 449 }, { label: '4hr/40km', fare: 599 },
  { label: '6hr/60km', fare: 799 }, { label: '8hr/80km', fare: 999 },
];

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
  rider?: { id?: string };
  rental_package?: string;
  trip_type?: string;
}
interface Driver {
  id: string;
  vehicle_type?: string;
  name?: string;
  rating?: number;
  rides_today?: number;
  earnings_today?: number;
  total_rides?: number;
  created_at?: string;
}

function isCabBooking(b: Booking) {
  return b.service_type?.category === 'cab' ||
    CAB_TYPES.includes(b.vehicle_type || '') ||
    CAB_TYPES.includes(b.service_type?.vehicle_type || '');
}

const TIME_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

export default function AnalyticsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('week');

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

  // Filter bookings by time
  const filterByTime = (bs: Booking[]) => {
    const now = new Date();
    if (timeFilter === 'today') {
      return bs.filter(b => b.created_at && new Date(b.created_at).toDateString() === now.toDateString());
    }
    if (timeFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
      return bs.filter(b => b.created_at && new Date(b.created_at) >= weekAgo);
    }
    if (timeFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
      return bs.filter(b => b.created_at && new Date(b.created_at) >= monthAgo);
    }
    return bs;
  };

  const filtered = filterByTime(bookings);

  // Volume — last 7 days trend
  const days = timeFilter === 'today' ? 24 : 7;
  const volumeTrend = Array.from({ length: days }, (_, i) => {
    if (timeFilter === 'today') {
      return {
        label: `${i}:00`,
        bookings: bookings.filter(b => b.created_at && new Date(b.created_at).getHours() === i &&
          new Date(b.created_at).toDateString() === new Date().toDateString()).length,
      };
    }
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      bookings: filterByTime(bookings).filter(b =>
        b.created_at && new Date(b.created_at).toDateString() === d.toDateString()
      ).length,
    };
  });

  // Revenue trend
  const revTrend = Array.from({ length: days }, (_, i) => {
    if (timeFilter === 'today') {
      return {
        label: `${i}:00`,
        revenue: bookings.filter(b =>
          b.created_at && new Date(b.created_at).getHours() === i &&
          new Date(b.created_at).toDateString() === new Date().toDateString() &&
          b.status === 'completed'
        ).reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0),
      };
    }
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      revenue: bookings.filter(b =>
        b.created_at && new Date(b.created_at).toDateString() === d.toDateString() &&
        b.status === 'completed'
      ).reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0),
    };
  });

  // Funnel
  const searching = filtered.filter(b => b.status === 'searching').length;
  const accepted = filtered.filter(b => ['accepted', 'in_progress', 'completed'].includes(b.status || '')).length;
  const completed = filtered.filter(b => b.status === 'completed').length;

  // Revenue by vehicle type stacked
  const stackedRev = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const ds = d.toDateString();
    const row: Record<string, string | number> = { day: d.toLocaleDateString('en-US', { weekday: 'short' }) };
    CAB_TYPES.forEach(vt => {
      row[VEHICLE_LABELS[vt]] = bookings.filter(b =>
        (b.vehicle_type === vt || b.service_type?.vehicle_type === vt) &&
        b.created_at && new Date(b.created_at).toDateString() === ds &&
        b.status === 'completed'
      ).reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);
    });
    return row;
  });

  // Top 10 drivers
  const top10 = [...drivers].sort((a, b) => (b.total_rides || 0) - (a.total_rides || 0)).slice(0, 10);
  const maxRides = top10[0]?.total_rides || 1;

  // Rating distribution
  const ratingDist = [5, 4, 3, 2, 1].map(r => ({
    name: `${r}⭐`,
    value: drivers.filter(d => d.rating && Math.round(d.rating) === r).length,
    color: ['#10B981', '#FF6B2B', '#F59E0B', '#EF4444', '#6B7280'][5 - r],
  }));

  // New driver signups last 7 days
  const newDrivers = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      count: drivers.filter(dr => dr.created_at && new Date(dr.created_at).toDateString() === d.toDateString()).length,
    };
  });

  // Repeat riders
  const riderCounts: Record<string, number> = {};
  bookings.forEach(b => {
    const rid = b.rider?.id;
    if (rid) riderCounts[rid] = (riderCounts[rid] || 0) + 1;
  });
  const repeatRiders = Object.values(riderCounts).filter(c => c >= 2).length;
  const totalRiders = Object.keys(riderCounts).length;
  const repeatPct = totalRiders ? Math.round((repeatRiders / totalRiders) * 100) : 0;

  // Package popularity
  const pkgPop = PACKAGES.map(pkg => ({
    name: pkg.label,
    count: bookings.filter(b => b.estimated_fare === pkg.fare || b.rental_package === pkg.label).length,
  }));

  // Rentals vs regular
  const rentalCount = bookings.filter(b => RENTAL_FARES.includes(b.estimated_fare || 0) || b.rental_package || b.trip_type === 'rental').length;
  const regularCount = bookings.length - rentalCount;
  const typeDonut = [
    { name: 'Regular', value: regularCount, color: '#FF6B2B' },
    { name: 'Rentals', value: rentalCount, color: '#FFCBA4' },
  ].filter(d => d.value > 0);

  // Peak hours heatmap (simplified as bar chart)
  const peakHours = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}h`,
    bookings: bookings.filter(b => b.created_at && new Date(b.created_at).getHours() === h).length,
  }));

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cab Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Deep insights into cab operations</p>
        </div>
        <div className="flex gap-2">
          {TIME_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTimeFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                timeFilter === f.key ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300'
              }`}
              style={timeFilter === f.key ? { backgroundColor: '#FF6B2B' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1 — Volume */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Cab Volume</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Bookings Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={volumeTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="bookings" stroke="#FF6B2B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Booking Funnel</h3>
            <div className="space-y-3 mt-4">
              {[
                { label: 'Searched', value: searching + accepted + completed, color: '#6B7280' },
                { label: 'Accepted', value: accepted, color: '#F59E0B' },
                { label: 'Completed', value: completed, color: '#10B981' },
              ].map(f => (
                <div key={f.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{f.label}</span>
                    <span className="font-semibold">{f.value}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((f.value) / (searching + accepted + completed || 1)) * 100)}%`,
                        backgroundColor: f.color,
                      }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Peak Hours Heatmap</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={peakHours}>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="bookings" fill="#FF6B2B" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Section 2 — Revenue */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Revenue</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#FF6B2B" fill="#FFF8F5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue by Vehicle Type (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stackedRev}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, '']} />
                <Legend />
                {CAB_TYPES.map((vt, i) => (
                  <Bar key={vt} dataKey={VEHICLE_LABELS[vt]} stackId="a" fill={ORANGE_SHADES[i]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Section 3 — Driver Performance */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Driver Performance</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 Cab Drivers</h3>
            <div className="space-y-2">
              {top10.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-4 text-gray-400">#{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{d.name || '—'}</span>
                  <div className="flex-1 max-w-24 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{
                      width: `${Math.round(((d.total_rides || 0) / maxRides) * 100)}%`,
                      backgroundColor: '#FF6B2B',
                    }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-12 text-right">{d.total_rides || 0} rides</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Rating Distribution</h3>
              <div className="flex gap-4">
                <ResponsiveContainer width="50%" height={140}>
                  <PieChart>
                    <Pie data={ratingDist.filter(r => r.value > 0)} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                      {ratingDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5 self-center">
                  {ratingDist.map(r => (
                    <div key={r.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                      <span className="text-gray-600">{r.name}</span>
                      <span className="ml-auto font-semibold">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">New Cab Driver Signups</h3>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={newDrivers}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#FF6B2B" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4 — Rider Behavior */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Rider Behavior</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">Repeat Riders</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{repeatPct}%</p>
            <p className="text-xs text-gray-400 mt-1">{repeatRiders} of {totalRiders} riders took 2+ rides</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">Total Unique Riders</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{totalRiders}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <p className="text-xs text-gray-500">Total Cab Bookings</p>
            <p className="text-3xl font-bold mt-1" style={{ color: '#FF6B2B' }}>{bookings.length}</p>
          </div>
        </div>
      </div>

      {/* Section 5 — Rentals Analytics */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Rentals Analytics</h2>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Rentals vs Regular Cab</h3>
            {typeDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={typeDonut} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                    {typeDonut.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            )}
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Package Popularity</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pkgPop} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip />
                <Bar dataKey="count" fill="#FF6B2B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
