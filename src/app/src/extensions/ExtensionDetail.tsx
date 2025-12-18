import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { 
  ArrowLeftIcon,
  PuzzlePieceIcon,
  Cog6ToothIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import Breadcrumb from '@/components/shared/Breadcrumb';
import ExtensionUILoader from './ExtensionUILoader';
import { useState } from 'react';
import ExtensionConfigModal from './ExtensionConfigModal';

interface UIMetadata {
  assets_url: string;
  root_id: string;
}

interface Extension {
  name: string;
  version: string;
  description: string;
  author: string;
  min_server_version: string;
  permissions?: string[];
  status: 'running' | 'stopped' | 'error';
  enabled: boolean;
  config?: Record<string, string>;
  ui?: UIMetadata;
}

const StatusBadge = ({ status }: { status: Extension['status'] }) => {
  const statusConfig = {
    running: {
      icon: CheckCircleIcon,
      text: 'Running',
      className: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
    },
    stopped: {
      icon: StopIcon,
      text: 'Stopped',
      className: 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    },
    error: {
      icon: ExclamationCircleIcon,
      text: 'Error',
      className: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
    }
  };

  const config = statusConfig[status] || statusConfig.stopped;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${config.className}`}>
      <Icon className="w-4 h-4 mr-1.5" />
      {config.text}
    </span>
  );
};

export default function ExtensionDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const { data: extension, isLoading, error } = useQuery<Extension>({
    queryKey: ['extension', name],
    queryFn: async () => {
      const response = await api.get(`/extensions/${name}`);
      return response.data;
    },
    enabled: !!name,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/extensions/${name}/enable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extension', name] });
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/extensions/${name}/disable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extension', name] });
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/extensions/${name}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      navigate('/extensions');
    },
  });

  const handleToggleEnabled = () => {
    if (extension?.enabled) {
      disableMutation.mutate();
    } else {
      enableMutation.mutate();
    }
  };

  const handleUninstall = () => {
    if (!confirm(`Are you sure you want to uninstall ${name}? This action cannot be undone.`)) return;
    uninstallMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !extension) {
    return (
      <div className="text-center py-12">
        <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Extension not found</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          The extension "{name}" could not be found.
        </p>
        <button
          onClick={() => navigate('/extensions')}
          className="mt-4 inline-flex items-center px-3 py-2 text-sm font-medium text-primary-600 hover:text-primary-500"
        >
          <ArrowLeftIcon className="mr-2 h-4 w-4" />
          Back to Extensions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Breadcrumb 
          items={[
            { name: 'Extensions' },
            { name: extension.name }
          ]} 
        />
        
        <div className="mt-4 flex items-start justify-between">
          <div className="flex items-center">
            <PuzzlePieceIcon className="h-12 w-12 text-primary-500" />
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {extension.name}
              </h1>
              <div className="flex items-center mt-1 space-x-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  v{extension.version}
                </span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  By {extension.author}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <StatusBadge status={extension.status} />
            
            <button
              onClick={handleToggleEnabled}
              disabled={enableMutation.isPending || disableMutation.isPending}
              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                extension.enabled
                  ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30'
                  : 'text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30'
              }`}
            >
              {extension.enabled ? (
                <>
                  <StopIcon className="mr-2 h-4 w-4" />
                  Disable
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2 h-4 w-4" />
                  Enable
                </>
              )}
            </button>
            
            <button
              onClick={() => setConfigModalOpen(true)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <Cog6ToothIcon className="mr-2 h-4 w-4" />
              Configure
            </button>
            
            <button
              onClick={handleUninstall}
              disabled={uninstallMutation.isPending}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-md hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <TrashIcon className="mr-2 h-4 w-4" />
              Uninstall
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          About
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          {extension.description}
        </p>
        
        {extension.permissions && extension.permissions.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Permissions
            </h3>
            <div className="flex flex-wrap gap-2">
              {extension.permissions.map((perm) => (
                <span 
                  key={perm}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Requires Kubelens v{extension.min_server_version} or later
        </div>
      </div>

      {/* Extension UI */}
      {extension.ui && extension.enabled && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Extension Interface
            </h2>
          </div>
          <div className="p-6">
            <ExtensionUILoader
              extensionName={extension.name}
              ui={extension.ui}
              config={extension.config}
            />
          </div>
        </div>
      )}

      {/* Config Modal */}
      <ExtensionConfigModal
        extension={extension}
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />
    </div>
  );
}
