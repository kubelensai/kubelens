import { useState, useCallback, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import api from '@/services/api';
import { useNotificationStore } from '@/stores/notificationStore';
import { 
  PuzzlePieceIcon, 
  ArrowDownTrayIcon, 
  ArrowUpTrayIcon,
  TrashIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  StopIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ChevronRightIcon,
  XMarkIcon,
  DocumentIcon,
  CloudArrowUpIcon
} from '@heroicons/react/24/outline';
import Breadcrumb from '@/components/shared/Breadcrumb';
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
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.text}
    </span>
  );
};

// Upload Extension Modal Component
interface UploadExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function UploadExtensionModal({ isOpen, onClose }: UploadExtensionModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('extension', file);
      
      const response = await api.post('/extensions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      addNotification({
        type: 'success',
        title: 'Extension Installed',
        message: data.message || 'Extension has been successfully installed.',
      });
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      handleClose();
    },
    onError: (error: any) => {
      addNotification({
        type: 'error',
        title: 'Installation Failed',
        message: error.response?.data?.error || 'Failed to install extension',
      });
    },
  });

  const handleClose = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    onClose();
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz')) {
        setSelectedFile(file);
      } else {
        addNotification({
          type: 'error',
          title: 'Invalid File',
          message: 'Only .tar.gz or .tgz files are accepted.',
        });
      }
    }
  }, [addNotification]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.tar.gz') || file.name.endsWith('.tgz')) {
        setSelectedFile(file);
      } else {
        addNotification({
          type: 'error',
          title: 'Invalid File',
          message: 'Only .tar.gz or .tgz files are accepted.',
        });
      }
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <ArrowUpTrayIcon className="h-6 w-6 text-white" />
                    </div>
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Install Extension
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={handleClose}
                    className="absolute right-4 top-4 rounded-lg p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
                    }`}
                  >
                    <CloudArrowUpIcon className={`mx-auto h-12 w-12 ${
                      isDragging ? 'text-primary-500' : 'text-gray-400'
                    }`} />
                    <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      Drag & drop your extension package here
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                      or
                    </p>
                    <label className="mt-3 inline-flex items-center px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="file"
                        accept=".tar.gz,.tgz"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      Browse Files
                    </label>
                    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                      Accepts .tar.gz or .tgz files (max 100MB)
                    </p>
                  </div>

                  {/* Selected File */}
                  {selectedFile && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <DocumentIcon className="h-8 w-8 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(selectedFile.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>

                      {/* Progress Bar */}
                      {uploadMutation.isPending && (
                        <div className="mt-3">
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-600 transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-gray-500 text-center">
                            Uploading... {uploadProgress}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 dark:bg-gray-700/50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleClose}
                    disabled={uploadMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || uploadMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Installing...
                      </>
                    ) : (
                      <>
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Install
                      </>
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

export default function ExtensionsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  
  const queryClient = useQueryClient();

  const { data: extensions = [], isLoading } = useQuery({
    queryKey: ['extensions'],
    queryFn: async () => {
      const response = await api.get('/extensions');
      return response.data || [];
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post(`/extensions/${name}/enable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post(`/extensions/${name}/disable`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.delete(`/extensions/${name}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    },
  });

  const handleToggleEnabled = async (ext: Extension) => {
    if (ext.enabled) {
      disableMutation.mutate(ext.name);
    } else {
      enableMutation.mutate(ext.name);
    }
  };

  const handleUninstall = async (name: string) => {
    if (!confirm(`Are you sure you want to uninstall ${name}? This action cannot be undone.`)) return;
    uninstallMutation.mutate(name);
  };

  const handleConfigure = (ext: Extension) => {
    setSelectedExtension(ext);
    setConfigModalOpen(true);
  };

  // Filter extensions based on search
  const filteredExtensions = extensions.filter((ext: Extension) => {
    const query = searchQuery.toLowerCase();
    return (
      ext.name.toLowerCase().includes(query) ||
      ext.description.toLowerCase().includes(query) ||
      ext.author.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb items={[{ name: 'Extensions' }]} />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
            Extensions
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your Kubelens extensions.
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
          Install Extension
        </button>
      </div>

      {/* Search Bar */}
      {extensions.length > 0 && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            placeholder="Search extensions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredExtensions.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow sm:px-6">
          <PuzzlePieceIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {searchQuery ? 'No matching extensions' : 'No extensions'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery 
              ? 'Try adjusting your search query.' 
              : 'Get started by installing a new extension.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExtensions.map((ext: Extension) => (
            <div
              key={ext.name}
              className="bg-white dark:bg-gray-800 overflow-hidden rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors"
            >
              <Link to={`/extensions/${ext.name}`} className="block p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <PuzzlePieceIcon className="h-8 w-8 text-primary-500" aria-hidden="true" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {ext.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        v{ext.version}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={ext.status} />
                </div>
                
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {ext.description}
                </p>

                {ext.permissions && ext.permissions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Permissions:</p>
                    <div className="flex flex-wrap gap-1">
                      {ext.permissions.map((perm) => (
                        <span 
                          key={perm}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        >
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Link>
              
              <div className="bg-gray-50 dark:bg-gray-700/50 px-5 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    By {ext.author}
                  </div>
                  <div className="flex items-center space-x-2">
                    {/* Enable/Disable Toggle */}
                    <button
                      onClick={(e) => { e.preventDefault(); handleToggleEnabled(ext); }}
                      disabled={enableMutation.isPending || disableMutation.isPending}
                      className={`p-1.5 rounded transition-colors ${
                        ext.enabled
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                      title={ext.enabled ? 'Disable' : 'Enable'}
                    >
                      {ext.enabled ? (
                        <StopIcon className="h-5 w-5" />
                      ) : (
                        <PlayIcon className="h-5 w-5" />
                      )}
                    </button>

                    {/* Configure Button */}
                    <button
                      onClick={(e) => { e.preventDefault(); handleConfigure(ext); }}
                      className="p-1.5 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="Configure"
                    >
                      <Cog6ToothIcon className="h-5 w-5" />
                    </button>

                    {/* Uninstall Button */}
                    <button
                      onClick={(e) => { e.preventDefault(); handleUninstall(ext.name); }}
                      disabled={uninstallMutation.isPending}
                      className="p-1.5 rounded text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Uninstall"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>

                    {/* View Details */}
                    <Link
                      to={`/extensions/${ext.name}`}
                      className="p-1.5 rounded text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="View Details"
                    >
                      <ChevronRightIcon className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Configuration Modal */}
      {selectedExtension && (
        <ExtensionConfigModal
          extension={selectedExtension}
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedExtension(null);
          }}
        />
      )}

      {/* Upload Extension Modal */}
      <UploadExtensionModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
      />
    </div>
  );
}
