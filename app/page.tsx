'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://gogobackend-production.up.railway.app';

export default function CabLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/gogoo/panel-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panel: 'cab', email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('cab_admin_token', data.token);
        localStorage.setItem('cab_admin_role', data.role);
        localStorage.setItem('cab_admin_email', data.email);
        toast.success('Welcome to Cab Panel!');
        setTimeout(() => router.push('/cab'), 500);
        return;
      }

      const err = await res.json();
      toast.error(err.error || 'Invalid credentials');
    } catch {
      toast.error('Connection failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#FF6B2B' }}>
            <span className="text-3xl">🚗</span>
          </div>
          <h1 className="text-2xl font-bold text-white">gogoo</h1>
          <p className="text-sm mt-1 font-semibold" style={{ color: '#FF6B2B' }}>Cab Operations Panel</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-6">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="cab@gogoo.in"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                  text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3
                  text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-bold text-sm transition-all
                disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#FF6B2B' }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : 'Sign In to Cab Panel'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500">Master admin credentials also work here</p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          gogoo Cab Operations · Aggarwal Publicity and Marketing Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}
