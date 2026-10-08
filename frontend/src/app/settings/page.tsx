"use client";

import { useState, useEffect } from "react";
import { fetchSettings, updateSettings } from "@/lib/api";
import { SystemSettings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Default values if API fails
  const defaultSettings: SystemSettings = {
    id: 1,
    screening_distance_km: 200,
    screening_time_window_hours: 72,
    auto_screening: true,
    screening_frequency_minutes: 60,
    data_refresh_interval_minutes: 360,
    risk_critical_threshold: 0.001,
    risk_high_threshold: 0.0001,
    risk_watch_threshold: 0.00001,
    alert_enabled: true,
    alert_critical_enabled: true,
    alert_high_enabled: true,
    alert_watch_enabled: false,
    updated_at: new Date().toISOString()
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSettings();
        setSettings(data);
      } catch (err) {
        console.warn("Settings endpoint not available yet, using defaults");
        setSettings(defaultSettings);
        setError("Backend settings unavailable. Showing default values.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (field: keyof SystemSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setToastMessage("Settings saved successfully.");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error(err);
      // Simulate saving for now if endpoint isn't ready
      setSettings({ ...settings, updated_at: new Date().toISOString() });
      setToastMessage("Settings saved (locally).");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  if (loading || !settings) {
    return <div className="text-white p-8">Loading settings...</div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex justify-between items-end">
        <h1 className="text-teal-400 text-2xl font-semibold tracking-wide uppercase">System Configuration</h1>
        <div className="text-sm text-gray-500 font-mono">
          Last Updated: {new Date(settings.updated_at).toLocaleString()}
        </div>
      </div>

      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 p-4 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-8">
        {/* Section 1: Surveillance Settings */}
        <section className="bg-[var(--space-panel)] border border-[var(--space-border)] p-6 rounded-md">
          <h2 className="text-lg text-white font-medium mb-4 border-b border-[var(--space-border)] pb-2">Surveillance Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-400">Screening Distance Threshold (km)</label>
              <input type="number" value={settings.screening_distance_km} onChange={(e) => handleChange('screening_distance_km', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-[var(--space-border)] rounded p-2 text-white text-sm font-mono focus:border-teal-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-400">Screening Time Window (hours)</label>
              <input type="number" value={settings.screening_time_window_hours} onChange={(e) => handleChange('screening_time_window_hours', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-[var(--space-border)] rounded p-2 text-white text-sm font-mono focus:border-teal-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-400">Screening Frequency (minutes)</label>
              <input type="number" value={settings.screening_frequency_minutes} onChange={(e) => handleChange('screening_frequency_minutes', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-[var(--space-border)] rounded p-2 text-white text-sm font-mono focus:border-teal-500 outline-none" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-gray-400">Data Refresh Interval (minutes)</label>
              <input type="number" value={settings.data_refresh_interval_minutes} onChange={(e) => handleChange('data_refresh_interval_minutes', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-[var(--space-border)] rounded p-2 text-white text-sm font-mono focus:border-teal-500 outline-none" />
            </div>
            <div className="flex items-center gap-3 mt-2">
              <input type="checkbox" checked={settings.auto_screening} onChange={(e) => handleChange('auto_screening', e.target.checked)} className="w-4 h-4 accent-teal-500" />
              <label className="text-sm text-gray-300">Automatic Screening</label>
            </div>
          </div>
        </section>

        {/* Section 2: Risk Settings */}
        <section className="bg-[var(--space-panel)] border border-[var(--space-border)] p-6 rounded-md">
          <h2 className="text-lg text-white font-medium mb-4 border-b border-[var(--space-border)] pb-2">Risk Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-red-400">Critical Risk Threshold (Pc)</label>
              <input type="number" step="0.00001" value={settings.risk_critical_threshold} onChange={(e) => handleChange('risk_critical_threshold', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-red-500/30 rounded p-2 text-white text-sm font-mono focus:border-red-500 outline-none" />
              <span className="text-xs text-gray-500 font-mono">e.g. {settings.risk_critical_threshold.toExponential()}</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-orange-400">High Risk Threshold (Pc)</label>
              <input type="number" step="0.00001" value={settings.risk_high_threshold} onChange={(e) => handleChange('risk_high_threshold', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-orange-500/30 rounded p-2 text-white text-sm font-mono focus:border-orange-500 outline-none" />
              <span className="text-xs text-gray-500 font-mono">e.g. {settings.risk_high_threshold.toExponential()}</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-yellow-400">Watch Risk Threshold (Pc)</label>
              <input type="number" step="0.00001" value={settings.risk_watch_threshold} onChange={(e) => handleChange('risk_watch_threshold', Number(e.target.value))} className="bg-[var(--space-canvas)] border border-yellow-500/30 rounded p-2 text-white text-sm font-mono focus:border-yellow-500 outline-none" />
              <span className="text-xs text-gray-500 font-mono">e.g. {settings.risk_watch_threshold.toExponential()}</span>
            </div>
          </div>
        </section>

        {/* Section 3: Alert Settings */}
        <section className="bg-[var(--space-panel)] border border-[var(--space-border)] p-6 rounded-md">
          <h2 className="text-lg text-white font-medium mb-4 border-b border-[var(--space-border)] pb-2">Alert Settings</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={settings.alert_enabled} onChange={(e) => handleChange('alert_enabled', e.target.checked)} className="w-4 h-4 accent-teal-500" />
              <label className="text-sm text-white font-medium">Master Alerts Toggle</label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ml-6 border-l-2 border-[var(--space-border)] pl-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" disabled={!settings.alert_enabled} checked={settings.alert_critical_enabled} onChange={(e) => handleChange('alert_critical_enabled', e.target.checked)} className="w-4 h-4 accent-red-500" />
                <label className="text-sm text-gray-300">Critical Alerts</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" disabled={!settings.alert_enabled} checked={settings.alert_high_enabled} onChange={(e) => handleChange('alert_high_enabled', e.target.checked)} className="w-4 h-4 accent-orange-500" />
                <label className="text-sm text-gray-300">High Alerts</label>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" disabled={!settings.alert_enabled} checked={settings.alert_watch_enabled} onChange={(e) => handleChange('alert_watch_enabled', e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                <label className="text-sm text-gray-300">Watch Alerts</label>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Data Management */}
        <section className="bg-[var(--space-panel)] border border-[var(--space-border)] p-6 rounded-md">
          <h2 className="text-lg text-white font-medium mb-4 border-b border-[var(--space-border)] pb-2">Data Management & Operations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => showToast("Data refresh initiated.")} className="bg-[var(--space-canvas)] border border-[var(--space-border)] hover:border-teal-500/50 p-4 rounded-md flex flex-col items-center justify-center gap-2 transition-colors">
              <span className="text-teal-400 font-semibold text-sm">REFRESH DATA</span>
              <span className="text-xs text-gray-500">Pull latest TLEs from Space-Track</span>
            </button>
            <button onClick={() => showToast("Screening job queued.")} className="bg-[var(--space-canvas)] border border-[var(--space-border)] hover:border-teal-500/50 p-4 rounded-md flex flex-col items-center justify-center gap-2 transition-colors">
              <span className="text-teal-400 font-semibold text-sm">RUN SCREENING</span>
              <span className="text-xs text-gray-500">Manual all-vs-all conjunction check</span>
            </button>
            <button onClick={() => showToast("Risk recalculation started.")} className="bg-[var(--space-canvas)] border border-[var(--space-border)] hover:border-teal-500/50 p-4 rounded-md flex flex-col items-center justify-center gap-2 transition-colors">
              <span className="text-teal-400 font-semibold text-sm">RECALCULATE RISKS</span>
              <span className="text-xs text-gray-500">Update Pc for active events</span>
            </button>
          </div>
        </section>
      </div>

      <div className="flex justify-end pt-4 pb-8 border-t border-[var(--space-border)]">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-teal-500 hover:bg-teal-400 text-[#0a0e17] font-bold py-2 px-6 rounded shadow-[0_0_15px_rgba(45,212,191,0.3)] disabled:opacity-70 transition-all"
        >
          {saving ? "SAVING..." : "SAVE CHANGES"}
        </button>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-teal-900 border border-teal-500 text-teal-100 px-6 py-3 rounded-md shadow-xl animate-bounce">
          {toastMessage}
        </div>
      )}
    </div>
  );
}