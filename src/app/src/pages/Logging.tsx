import { useState, useEffect } from 'react';
import api from '@/services/api';
import { DataTable, Column } from '@/components/shared/DataTable';
import { ShieldCheckIcon, ExclamationTriangleIcon, XCircleIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Breadcrumb from '@/components/shared/Breadcrumb';
import { formatDateTime, getLocalDateTimeInputValue, localDateTimeToISO } from '@/utils/dateFormat';

interface AuditLog {
  id: number;
  datetime: string;
  event_type: string;
  event_category: string;
  level: string;
  user_id?: number;
  username?: string;
  email?: string;
  source_ip: string;
  user_agent?: string;
  request_method?: string;
  request_uri?: string;
  resource?: string;
  action?: string;
  description: string;
  metadata?: string;
  success: boolean;
  error_message?: string;
  created_at: string;
}

interface AuditStats {
  total_events: number;
  success_count: number;
  failure_count: number;
  auth_events: number;
  security_violations: number;
  failed_actions: number;
}

const Logging = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Filters
  const [startDate, setStartDate] = useState(getLocalDateTimeInputValue(-1)); // 24 hours ago
  const [endDate, setEndDate] = useState(getLocalDateTimeInputValue(0)); // Now
  const [eventCategory, setEventCategory] = useState('');
  const [level, setLevel] = useState('');
  const [sourceIP, setSourceIP] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [currentPage, eventCategory, level, sourceIP, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        page_size: pageSize,
      };

      if (startDate) params.start_date = localDateTimeToISO(startDate);
      if (endDate) params.end_date = localDateTimeToISO(endDate);
      if (eventCategory) params.event_category = eventCategory;
      if (level) params.level = level;
      if (sourceIP) params.source_ip = sourceIP;
      if (search) params.search = search;

      const response = await api.get('/audit/logs', { params });
      setLogs(response.data.logs || []);
      setTotalLogs(response.data.total || 0);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/audit/logs/stats', {
        params: { period: '24h' }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchLogs();
  };

  const handleClearFilters = () => {
    setStartDate(getLocalDateTimeInputValue(-1)); // 24 hours ago
    setEndDate(getLocalDateTimeInputValue(0)); // Now
    setEventCategory('');
    setLevel('');
    setSourceIP('');
    setSearch('');
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      const start = startDate ? localDateTimeToISO(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = endDate ? localDateTimeToISO(endDate) : new Date().toISOString();

      const response = await api.post('/audit/export', {
        start_date: start,
        end_date: end,
        format: 'json'
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      INFO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      WARN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      ERROR: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[level as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'authentication': return 'text-green-600 dark:text-green-400';
      case 'security': return 'text-red-600 dark:text-red-400';
      case 'audit': return 'text-blue-600 dark:text-blue-400';
      case 'system': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };


  const columns: Column<AuditLog>[] = [
    {
      key: 'datetime',
      header: 'Timestamp',
      accessor: (log) => (
        <span className="whitespace-nowrap text-sm text-gray-900 dark:text-white">
          {formatDateTime(log.datetime)}
        </span>
      ),
      sortable: true,
      sortValue: (log) => log.datetime,
      searchValue: (log) => formatDateTime(log.datetime),
    },
    {
      key: 'level',
      header: 'Level',
      accessor: (log) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getLevelBadge(log.level)}`}>
          {log.level}
        </span>
      ),
      sortable: true,
      sortValue: (log) => log.level,
      searchValue: (log) => log.level,
    },
    {
      key: 'event_category',
      header: 'Category',
      accessor: (log) => (
        <span className={`text-sm font-medium capitalize ${getCategoryColor(log.event_category)}`}>
          {log.event_category}
        </span>
      ),
      sortable: true,
      sortValue: (log) => log.event_category,
      searchValue: (log) => log.event_category,
    },
    {
      key: 'username',
      header: 'User',
      accessor: (log) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {log.username || log.email || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (log) => log.username || log.email || '',
      searchValue: (log) => `${log.username || ''} ${log.email || ''}`,
    },
    {
      key: 'source_ip',
      header: 'IP Address',
      accessor: (log) => (
        <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
          {log.source_ip}
        </span>
      ),
      sortable: true,
      sortValue: (log) => log.source_ip,
      searchValue: (log) => log.source_ip,
    },
    {
      key: 'description',
      header: 'Description',
      accessor: (log) => (
        <span className="text-sm text-gray-900 dark:text-white">
          {log.description}
        </span>
      ),
      sortable: false,
      searchValue: (log) => log.description,
    },
    {
      key: 'success',
      header: 'Status',
      accessor: (log) => (
        <span className={`inline-flex items-center gap-1 text-sm ${log.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {log.success ? (
            <>
              <CheckCircleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Success</span>
            </>
          ) : (
            <>
              <XCircleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Failed</span>
            </>
          )}
        </span>
      ),
      sortable: true,
      sortValue: (log) => log.success ? 'success' : 'failed',
      searchValue: (log) => log.success ? 'success' : 'failed',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'Audit Logs' }]} />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Audit Logs</h1>
          <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
            View and analyze system audit logs
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShieldCheckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400 md:h-8 md:w-8" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 md:text-sm">Total Events</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white md:text-2xl">{stats.total_events.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400 md:h-8 md:w-8" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 md:text-sm">Success</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white md:text-2xl">{stats.success_count.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400 md:h-8 md:w-8" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 md:text-sm">Failed</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white md:text-2xl">{stats.failure_count.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 md:h-8 md:w-8" />
              </div>
              <div className="ml-3 md:ml-4">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 md:text-sm">Security</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white md:text-2xl">{stats.security_violations.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white md:text-lg">Filters</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
              Category
            </label>
            <select
              value={eventCategory}
              onChange={(e) => setEventCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Categories</option>
              <option value="authentication">Authentication</option>
              <option value="security">Security</option>
              <option value="audit">Audit</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
              Level
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Levels</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
              IP Address
            </label>
            <input
              type="text"
              value={sourceIP}
              onChange={(e) => setSourceIP(e.target.value)}
              placeholder="Filter by IP..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700 dark:text-gray-300 md:text-sm">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description..."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleSearch}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Clear Filters
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Export Logs
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-lg bg-white shadow dark:bg-gray-800">
        <DataTable
          data={logs}
          columns={columns}
          isLoading={loading}
          emptyMessage="No audit logs found"
          showPagination={false}
          keyExtractor={(log) => log.id.toString()}
        />

        {/* Custom Pagination */}
        {totalLogs > pageSize && (
          <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-700 md:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-700 dark:text-gray-300 md:text-sm">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalLogs)} of {totalLogs} results
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm text-gray-900 dark:text-white">
                  Page {currentPage} of {Math.ceil(totalLogs / pageSize)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalLogs / pageSize), p + 1))}
                  disabled={currentPage >= Math.ceil(totalLogs / pageSize)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Logging;
