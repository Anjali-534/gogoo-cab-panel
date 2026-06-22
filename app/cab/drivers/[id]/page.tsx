'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Star, RefreshCw, X } from 'lucide-react';
import toast from 'react-hot-toast';

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
const DOC_STATUS_BADGE: Record<string, string> = {
  approved:   'bg-green-100 text-green-700',
  pending:    'bg-yellow-100 text-yellow-700',
  rejected:   'bg-red-100 text-red-700',
  missing:    'bg-gray-100 text-gray-500',
};

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('cab_admin_token') : '';
}
function authHeaders() {
  return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
}
function docURL(url: string) {
  return url?.startsWith('http') ? url : `${API}${url}`;
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
  total_rides?: number;
  total_earnings?: number;
  wallet_balance?: number;
  is_online?: boolean;
  is_blocked?: boolean;
  is_verified?: boolean;
  registration_fee_paid?: boolean;
  created_at?: string;
  block_reason?: string;
  blocked_until?: string;
  documents_status?: string;
}

interface Booking {
  id: string;
  status?: string;
  estimated_fare?: number;
  final_fare?: number;
  created_at?: string;
  pickup_address?: string;
  drop_address?: string;
  distance_km?: number;
  rider_name?: string;
  service_name?: string;
}

interface Doc {
  doc_type: string;
  label?: string;
  status?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  reject_reason?: string;
  uploaded?: boolean;
  uploaded_at?: string;
}

function MetricCard({ label, value, red }: { label: string; value: string | number; red?: boolean }) {
  return (
    <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
      <p className="text-xs text-orange-700 font-medium">{label}</p>
      <p className={`text-xl font-bold mt-1 ${red ? 'text-red-500' : ''}`} style={red ? {} : { color: '#FF6B2B' }}>{value}</p>
    </div>
  );
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [rideTab, setRideTab] = useState('All');
  const [ridesLoading, setRidesLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dRes, docsRes, bRes] = await Promise.all([
        fetch(`${API}/gogoo/drivers/${id}`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/drivers/${id}/documents`, { headers: authHeaders() }),
        fetch(`${API}/gogoo/drivers/${id}/bookings`, { headers: authHeaders() }),
      ]);
      const dData = await dRes.json();
      const docsData = await docsRes.json();
      const bData = await bRes.json();

      setDriver(dData.data || dData);
      setDocs(docsData.docs || []);
      const allBookings: Booking[] = Array.isArray(bData) ? bData : bData.bookings || [];
      setBookings(allBookings.filter(b =>
        CAB_TYPES.includes((b as any).vehicle_type || '') ||
        CAB_TYPES.includes((b as any).service_type?.vehicle_type || '')
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
    try {
      const res = await fetch(`${API}/gogoo/drivers/${id}/block`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ action: driver.is_blocked ? 'unblock' : 'block' }),
      });
      if (res.ok) {
        toast.success(driver.is_blocked ? 'Driver unblocked' : 'Driver blocked');
        fetchData();
      }
    } catch { toast.error('Action failed'); }
  }

  async function verifyDriver() {
    try {
      const res = await fetch(`${API}/gogoo/drivers/${id}/verify`, {
        method: 'PATCH', headers: authHeaders(),
      });
      if (res.ok) {
        toast.success('Driver verified');
        fetchData();
      }
    } catch { toast.error('Failed to verify driver'); }
  }

  const refreshBookings = useCallback(async () => {
    setRidesLoading(true);
    try {
      const res = await fetch(`${API}/gogoo/drivers/${id}/bookings`, { headers: authHeaders() });
      const data = await res.json();
      const all: Booking[] = Array.isArray(data) ? data : (data?.bookings || []);
      setBookings(all.filter(b =>
        CAB_TYPES.includes((b as any).vehicle_type || '') ||
        CAB_TYPES.includes((b as any).service_type?.vehicle_type || '')
      ));
    } catch { toast.error('Failed to refresh rides'); }
    finally { setRidesLoading(false); }
  }, [id]);

  async function reviewDoc(docType: string, status: string) {
    if (status === 'rejected' && !rejectReason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    try {
      const res = await fetch(`${API}/gogoo/drivers/${id}/documents/${docType}/review`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status, reject_reason: status === 'rejected' ? rejectReason : '' }),
      });
      if (res.ok) {
        toast.success(status === 'approved' ? 'Document approved' : 'Document rejected');
        setReviewing(null);
        setRejectReason('');
        fetchData();
      } else {
        toast.error('Failed to update document');
      }
    } catch { toast.error('Failed to update document'); }
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

  const completedRides = bookings.filter(b => b.status === 'completed');
  const totalEarnings = completedRides.reduce((s, b) => s + (b.final_fare || b.estimated_fare || 0), 0);
  const rating = driver.rating || 0;
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(rating));
  const approvedDocs = docs.filter(d => d.status === 'approved').length;
  const filteredRides = rideTab === 'All' ? bookings
    : bookings.filter(r => r.status === rideTab.toLowerCase().replace(' ', '_'));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/cab/drivers')}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{driver.name}</h1>
          <p className="text-sm text-gray-500">Cab Driver Profile</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition">
            <RefreshCw size={16} />
          </button>
          <a href={`tel:${driver.phone}`}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ backgroundColor: '#FFF8F5', color: '#FF6B2B' }}>
            <Phone size={14} /> Call
          </a>
          {!driver.is_verified && (
            <button onClick={verifyDriver}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-green-50 text-green-600 hover:bg-green-100 transition">
              ✓ Verify Driver
            </button>
          )}
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
                  driver.is_blocked ? 'bg-red-500' : driver.is_online ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium">
                  {driver.is_blocked ? 'Blocked' : driver.is_online ? 'Online' : 'Offline'}
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
              <p className="text-xs text-gray-400 mb-1">Verification</p>
              <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                driver.is_verified ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
              }`}>
                {driver.is_verified ? '✓ Verified' : '⏳ Pending'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Reg Fee</p>
              <span className={`text-sm font-medium ${driver.registration_fee_paid ? 'text-green-600' : 'text-red-500'}`}>
                {driver.registration_fee_paid ? '✅ Paid' : '⏳ Pending'}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Joined</p>
              <p className="font-medium text-gray-800">
                {driver.created_at ? new Date(driver.created_at).toLocaleDateString('en-IN') : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Rides" value={driver.total_rides || completedRides.length} />
        <MetricCard label="Wallet Balance" value={`₹${(driver.wallet_balance || 0).toLocaleString('en-IN')}`}
          red={(driver.wallet_balance || 0) < 0} />
        <MetricCard label="Total Earnings" value={`₹${(driver.total_earnings || totalEarnings).toLocaleString('en-IN')}`} />
        <MetricCard label="Docs Approved" value={`${approvedDocs}/${docs.length}`} />
      </div>

      {/* Documents */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Documents</h3>
            <p className="text-xs text-gray-400 mt-0.5">{approvedDocs}/{docs.length} approved</p>
          </div>
          {docs.length > 0 && (
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 bg-orange-400 rounded-full transition-all"
                style={{ width: `${docs.length ? (approvedDocs / docs.length) * 100 : 0}%` }} />
            </div>
          )}
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📄</p>
              <p className="text-sm">No documents uploaded yet</p>
            </div>
          ) : docs.map(doc => (
            <div key={doc.doc_type} className="border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{doc.label || doc.doc_type}</p>
                  <span className={`inline-block mt-1 text-[11px] font-bold px-2 py-1 rounded-full capitalize ${
                    DOC_STATUS_BADGE[doc.status || 'missing'] || DOC_STATUS_BADGE.missing
                  }`}>
                    {doc.status === 'missing' || !doc.uploaded ? 'Not uploaded' : doc.status}
                  </span>
                </div>
              </div>

              {doc.reject_reason && (
                <p className="text-xs text-red-500 mb-2">⚠ {doc.reject_reason}</p>
              )}

              {doc.uploaded && doc.file_url && (
                <div className="mt-2 flex gap-2">
                  <button onClick={() => setPreviewDoc(doc)}
                    className="text-xs px-3 py-1.5 bg-orange-50 text-orange-500 border border-orange-200 rounded-lg hover:bg-orange-100 transition font-semibold">
                    👁 Preview
                  </button>
                  <a href={docURL(doc.file_url)} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-500 border border-blue-200 rounded-lg hover:bg-blue-100 transition font-semibold">
                    📥 Download
                  </a>
                </div>
              )}

              {doc.uploaded && doc.status !== 'approved' && (
                <div className="mt-3">
                  {reviewing === doc.doc_type ? (
                    <div className="space-y-2">
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Rejection reason (required for reject)"
                        rows={2}
                        className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => reviewDoc(doc.doc_type, 'approved')}
                          className="flex-1 py-2 bg-green-50 text-green-600 border border-green-200 rounded-lg text-xs font-bold hover:bg-green-100 transition">
                          ✓ Approve
                        </button>
                        <button onClick={() => reviewDoc(doc.doc_type, 'rejected')}
                          className="flex-1 py-2 bg-red-50 text-red-500 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition">
                          ✗ Reject
                        </button>
                        <button onClick={() => { setReviewing(null); setRejectReason(''); }}
                          className="px-3 py-2 text-gray-400 text-xs hover:text-gray-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setReviewing(doc.doc_type)}
                      className="w-full py-2 text-xs font-bold bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-orange-50 hover:border-orange-200 hover:text-orange-500 transition">
                      Review Document
                    </button>
                  )}
                </div>
              )}

              {!doc.uploaded && (
                <p className="text-xs text-gray-400 mt-2">Driver has not uploaded this document yet.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cab Ride History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Cab Ride History</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {completedRides.length} completed · ₹{totalEarnings.toLocaleString('en-IN')} earned
            </p>
          </div>
          <button onClick={refreshBookings} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 transition">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="px-6 py-4 border-b border-gray-100 flex gap-2 flex-wrap">
          {['All', 'Completed', 'Cancelled', 'In Progress'].map(t => {
            const cnt = t === 'All' ? bookings.length
              : bookings.filter(r => r.status === t.toLowerCase().replace(' ', '_')).length;
            return (
              <button key={t} onClick={() => setRideTab(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  rideTab === t
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-orange-300'
                }`}>
                {t} <span className="ml-1 opacity-70">{cnt}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          {ridesLoading ? (
            <div className="p-10 text-center text-gray-400">Loading rides…</div>
          ) : filteredRides.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">🏁</p>
              <p className="text-sm">No {rideTab.toLowerCase()} rides found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Date', 'Rider', 'Route', 'Service', 'Distance', 'Fare', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRides.slice(0, 50).map((b: any) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {b.created_at ? new Date(b.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      }) : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{b.rider_name || '—'}</td>
                    <td className="px-5 py-3 max-w-[180px]">
                      <p className="text-xs text-gray-600 truncate">● {b.pickup_address || '—'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">● {b.drop_address || '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{b.service_name || (b as any).service_type?.name || '—'}</td>
                    <td className="px-5 py-3 text-xs text-gray-700 text-right">{Number(b.distance_km || 0).toFixed(1)} km</td>
                    <td className="px-5 py-3 text-sm font-bold text-gray-900 text-right">
                      ₹{Math.round(b.final_fare || b.estimated_fare || 0)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full capitalize"
                        style={{
                          backgroundColor: `${STATUS_COLORS[b.status || ''] || '#6B7280'}20`,
                          color: STATUS_COLORS[b.status || ''] || '#6B7280',
                        }}>
                        {b.status?.replace('_', ' ') || 'unknown'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewDoc(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-900">{previewDoc.label || previewDoc.doc_type}</h4>
              <div className="flex gap-2">
                <a href={docURL(previewDoc.file_url || '')} target="_blank" rel="noreferrer"
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-500 border border-blue-200 rounded-lg font-semibold">
                  📥 Download
                </a>
                <button onClick={() => setPreviewDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            </div>
            {previewDoc.mime_type === 'application/pdf' ? (
              <iframe src={docURL(previewDoc.file_url || '')}
                className="w-full h-[60vh] rounded-xl border border-gray-200" title={previewDoc.label} />
            ) : (
              <img src={docURL(previewDoc.file_url || '')} alt={previewDoc.label}
                className="w-full rounded-xl border border-gray-100 object-contain max-h-[60vh]" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
