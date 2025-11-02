import { useState, useEffect } from 'react';
import api from '@/services/api';
import { Switch } from '@headlessui/react';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { useNotificationStore } from '@/stores/notificationStore';

interface AuditSettings {
  id: number;
  enabled: boolean;
  collect_authentication: boolean;
  collect_security: boolean;
  collect_audit: boolean;
  collect_system: boolean;
  collect_info: boolean;
  collect_warn: boolean;
  collect_error: boolean;
  collect_critical: boolean;
  sampling_enabled: boolean;
  sampling_rate: number;
}

interface Preset {
  name: string;
  description: string;
}

const AuditSettings = () => {
  const [settings, setSettings] = useState<AuditSettings | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageImpact, setStorageImpact] = useState<number>(0);
  const { addNotification } = useNotificationStore();

  useEffect(() => {
    fetchSettings();
    fetchPresets();
  }, []);

  useEffect(() => {
    if (settings) {
      fetchStorageImpact();
    }
  }, [settings]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/audit/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch audit settings:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to load audit settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await api.get('/audit/settings/presets');
      setPresets(response.data);
    } catch (error) {
      console.error('Failed to fetch presets:', error);
    }
  };

  const fetchStorageImpact = async () => {
    try {
      const response = await api.get('/audit/settings/impact');
      const value = response.data.reduction_percentage;
      setStorageImpact(typeof value === 'number' ? value : 0);
    } catch (error) {
      console.error('Failed to fetch storage impact:', error);
      setStorageImpact(0);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await api.put('/audit/settings', settings);
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Audit settings saved successfully'
      });
      fetchStorageImpact();
    } catch (error) {
      console.error('Failed to save settings:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to save audit settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = async (presetName: string) => {
    try {
      setSaving(true);
      await api.post(`/audit/settings/preset/${presetName}`);
      addNotification({
        type: 'success',
        title: 'Success',
        message: `Preset "${presetName}" applied successfully`
      });
      await fetchSettings();
    } catch (error) {
      console.error('Failed to apply preset:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to apply preset'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchSettings();
    addNotification({
      type: 'success',
      title: 'Success',
      message: 'Settings reset to saved values'
    });
  };

  const updateSetting = (key: keyof AuditSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { name: 'Audit Settings' },
        ]}
      />

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Audit Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure audit logging behavior and retention policies
        </p>
      </div>

      {/* Quick Presets */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Quick Presets</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleApplyPreset(preset.name)}
              disabled={saving}
              className="rounded-lg border-2 border-gray-300 p-3 text-left transition-colors hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:border-blue-400 md:p-4"
            >
              <h3 className="text-sm font-medium capitalize text-gray-900 dark:text-white md:text-base">
                {preset.name.replace(/_/g, ' ')}
              </h3>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Master Control */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Master Control</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white md:text-base">Enable Audit Logging</h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
              {settings.enabled ? 'Audit logging is currently enabled' : 'Audit logging is currently disabled'}
            </p>
            {!settings.enabled && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400 md:text-sm">
                ⚠️ Disabling will stop ALL audit log collection
              </p>
            )}
          </div>
          <Switch
            checked={settings.enabled}
            onChange={(value) => updateSetting('enabled', value)}
            className={`${settings.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
          >
            <span className={`${settings.enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
          </Switch>
        </div>
      </div>

      {/* Event Categories */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Event Categories</h2>
        <div className="space-y-4">
          {[
            { key: 'collect_authentication', label: 'Authentication Events', description: 'Login, logout, password changes, MFA' },
            { key: 'collect_security', label: 'Security Violations', description: 'Rate limits, account lockouts, injection attempts' },
            { key: 'collect_audit', label: 'Audit Events', description: 'User, group, cluster, and resource changes' },
            { key: 'collect_system', label: 'System Events', description: 'Startup, shutdown, configuration changes' },
          ].map((category) => (
            <div key={category.key} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white md:text-base">{category.label}</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 md:text-sm">{category.description}</p>
              </div>
              <Switch
                checked={settings[category.key as keyof AuditSettings] as boolean}
                onChange={(value) => updateSetting(category.key as keyof AuditSettings, value)}
                disabled={!settings.enabled}
                className={`${settings[category.key as keyof AuditSettings] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`${settings[category.key as keyof AuditSettings] ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </Switch>
            </div>
          ))}
        </div>
      </div>

      {/* Log Levels */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Log Levels</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { key: 'collect_info', label: 'INFO', color: 'text-blue-600 dark:text-blue-400' },
            { key: 'collect_warn', label: 'WARN', color: 'text-yellow-600 dark:text-yellow-400' },
            { key: 'collect_error', label: 'ERROR', color: 'text-orange-600 dark:text-orange-400' },
            { key: 'collect_critical', label: 'CRITICAL', color: 'text-red-600 dark:text-red-400' },
          ].map((level) => (
            <div key={level.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700 md:p-4">
              <span className={`text-sm font-medium md:text-base ${level.color}`}>{level.label}</span>
              <Switch
                checked={settings[level.key as keyof AuditSettings] as boolean}
                onChange={(value) => updateSetting(level.key as keyof AuditSettings, value)}
                disabled={!settings.enabled}
                className={`${settings[level.key as keyof AuditSettings] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className={`${settings[level.key as keyof AuditSettings] ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
              </Switch>
            </div>
          ))}
        </div>
      </div>

      {/* Sampling */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Sampling (Volume Reduction)</h2>
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white md:text-base">Enable Sampling</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                Randomly sample events to reduce storage (useful for high-volume systems)
              </p>
            </div>
            <Switch
              checked={settings.sampling_enabled}
              onChange={(value) => updateSetting('sampling_enabled', value)}
              disabled={!settings.enabled}
              className={`${settings.sampling_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className={`${settings.sampling_enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} />
            </Switch>
          </div>

          {settings.sampling_enabled && (
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
                Sampling Rate: {((settings.sampling_rate || 0) * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={settings.sampling_rate || 0}
                onChange={(e) => updateSetting('sampling_rate', parseFloat(e.target.value))}
                disabled={!settings.enabled}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700"
              />
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                {settings.sampling_rate === 1 ? 'Log all events (100%)' : `Log ${((settings.sampling_rate || 0) * 100).toFixed(0)}% of events randomly`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Storage Impact */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Current Impact</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm md:text-base">
            <span className="text-gray-600 dark:text-gray-400">Storage Reduction:</span>
            <span className="font-medium text-gray-900 dark:text-white">{(storageImpact || 0).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${storageImpact || 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 md:text-sm">
            {storageImpact === 0 ? 'Full logging (no reduction)' : `Estimated ${(storageImpact || 0).toFixed(1)}% reduction in storage usage`}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:text-base"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="rounded-md bg-gray-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 md:text-base"
        >
          Reset to Saved
        </button>
      </div>
    </div>
  );
};

export default AuditSettings;
