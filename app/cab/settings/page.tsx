'use client';
import { useState, useEffect } from 'react';
import { Save, CheckCircle } from 'lucide-react';

const DEFAULTS = {
  baseFare: { cab_2w: 20, cab_3w: 30, cab_4w: 40, cab_4w_suv: 60 },
  perKmRate: { cab_2w: 8, cab_3w: 10, cab_4w: 12, cab_4w_suv: 16 },
  surgeMultiplier: 1.5,
  rentalPrices: { '1hr/10km': 149, '1hr/15km': 179, '2hr/20km': 249, '2hr/25km': 299, '3hr/30km': 449, '4hr/40km': 599, '6hr/60km': 799, '8hr/80km': 999 },
  cancellationFee: 50,
  maxSearchRadius: 10,
  autoCancelMinutes: 5,
  showETA: true,
  notifyDriversSurge: true,
  lowDriverThreshold: 5,
};

const VEHICLE_LABELS = { cab_2w: '2 Wheeler', cab_3w: 'Auto', cab_4w: 'Mini/Sedan', cab_4w_suv: 'Prime SUV' };
const VEHICLE_EMOJI = { cab_2w: '🛵', cab_3w: '🛺', cab_4w: '🚗', cab_4w_suv: '🚙' };

type Settings = typeof DEFAULTS;

function InputField({ label, value, onChange, prefix, suffix, type = 'number', step }: {
  label: string;
  value: number | string | boolean;
  onChange: (v: number | string | boolean) => void;
  prefix?: string;
  suffix?: string;
  type?: string;
  step?: string;
}) {
  if (type === 'checkbox') {
    return (
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700">{label}</span>
        <button
          onClick={() => onChange(!value)}
          className={`w-11 h-6 rounded-full transition-colors ${value ? 'bg-orange-500' : 'bg-gray-300'}`}>
          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${value ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value as number}
          onChange={e => onChange(Number(e.target.value))}
          step={step}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors"
          style={{ paddingLeft: prefix ? '1.75rem' : undefined, paddingRight: suffix ? '2.5rem' : undefined }}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('cab_panel_settings');
    if (stored) {
      try { setSettings(JSON.parse(stored)); } catch { /**/ }
    }
  }, []);

  function updateBaseFare(vt: string, val: number) {
    setSettings(s => ({ ...s, baseFare: { ...s.baseFare, [vt]: val } }));
  }
  function updatePerKm(vt: string, val: number) {
    setSettings(s => ({ ...s, perKmRate: { ...s.perKmRate, [vt]: val } }));
  }
  function updateRentalPrice(pkg: string, val: number) {
    setSettings(s => ({ ...s, rentalPrices: { ...s.rentalPrices, [pkg]: val } }));
  }

  function saveSettings() {
    localStorage.setItem('cab_panel_settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const VEHICLE_KEYS = Object.keys(VEHICLE_LABELS) as (keyof typeof VEHICLE_LABELS)[];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cab Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure cab operations pricing and rules</p>
        </div>
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-all"
          style={{ backgroundColor: saved ? '#10B981' : '#FF6B2B' }}>
          {saved ? <CheckCircle size={16} /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Pricing */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-5">Pricing by Vehicle Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {VEHICLE_KEYS.map(vt => (
            <div key={vt} className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-orange-100">
                <span className="text-xl">{VEHICLE_EMOJI[vt]}</span>
                <span className="font-semibold text-sm text-gray-700" style={{ color: '#FF6B2B' }}>
                  {VEHICLE_LABELS[vt]}
                </span>
              </div>
              <InputField
                label="Base Fare"
                value={settings.baseFare[vt]}
                onChange={v => updateBaseFare(vt, v as number)}
                prefix="₹"
              />
              <InputField
                label="Per KM Rate"
                value={settings.perKmRate[vt]}
                onChange={v => updatePerKm(vt, v as number)}
                prefix="₹"
                suffix="/km"
              />
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputField
            label="Surge Multiplier (default)"
            value={settings.surgeMultiplier}
            onChange={v => setSettings(s => ({ ...s, surgeMultiplier: v as number }))}
            step="0.1"
            suffix="x"
          />
          <InputField
            label="Cancellation Fee"
            value={settings.cancellationFee}
            onChange={v => setSettings(s => ({ ...s, cancellationFee: v as number }))}
            prefix="₹"
          />
        </div>
      </div>

      {/* Rental Prices */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-5">Rental Package Prices</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(settings.rentalPrices).map(([pkg, price]) => (
            <InputField
              key={pkg}
              label={pkg}
              value={price}
              onChange={v => updateRentalPrice(pkg, v as number)}
              prefix="₹"
            />
          ))}
        </div>
      </div>

      {/* Operations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-5">Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <InputField
            label="Max Driver Search Radius"
            value={settings.maxSearchRadius}
            onChange={v => setSettings(s => ({ ...s, maxSearchRadius: v as number }))}
            suffix="km"
          />
          <InputField
            label="Auto-Cancel if No Driver Found In"
            value={settings.autoCancelMinutes}
            onChange={v => setSettings(s => ({ ...s, autoCancelMinutes: v as number }))}
            suffix="min"
          />
          <div className="md:col-span-2">
            <InputField
              label="Show Estimated Arrival Time to Rider"
              value={settings.showETA}
              onChange={v => setSettings(s => ({ ...s, showETA: v as boolean }))}
              type="checkbox"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-5">Notifications</h2>
        <div className="space-y-4">
          <InputField
            label="Auto-notify drivers about surge zones"
            value={settings.notifyDriversSurge}
            onChange={v => setSettings(s => ({ ...s, notifyDriversSurge: v as boolean }))}
            type="checkbox"
          />
          <div className="pt-2 border-t border-gray-100">
            <InputField
              label="Low Driver Availability Alert Threshold"
              value={settings.lowDriverThreshold}
              onChange={v => setSettings(s => ({ ...s, lowDriverThreshold: v as number }))}
              suffix="drivers"
            />
            <p className="text-xs text-gray-400 mt-1">Alert when online drivers drop below this number</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold transition-all"
          style={{ backgroundColor: saved ? '#10B981' : '#FF6B2B' }}>
          {saved ? <CheckCircle size={18} /> : <Save size={18} />}
          {saved ? 'Settings Saved!' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
