import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  KeyIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import Breadcrumb from '@/components/shared/Breadcrumb'
import YamlEditor from '@/components/shared/YamlEditor'
import { DataTable, Column } from '@/components/shared/DataTable'
import ConfirmationModal from '@/components/shared/ConfirmationModal'
import { useNotificationStore } from '@/stores/notificationStore'
import api from '@/services/api'
import yaml from 'js-yaml'
import { formatAge } from '@/utils/format'
import * as jsrsasign from 'jsrsasign'

interface SecretDetailsProps {}

type TabType = 'overview' | 'yaml' | 'events'

interface TLSCertInfo {
  fieldName: string
  commonName: string
  issuer: string
  serialNumber: string
  notBefore: string
  notAfter: string
  isExpired: boolean
  daysUntilExpiry: number
}

export default function SecretDetails({}: SecretDetailsProps) {
  const { cluster, namespace, secretName } = useParams<{ cluster: string; namespace: string; secretName: string }>()
  const { addNotification } = useNotificationStore()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [secret, setSecret] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yamlContent, setYamlContent] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    labels: false,
    annotations: false,
    data: false,
  })
  const [tlsCertInfos, setTlsCertInfos] = useState<TLSCertInfo[]>([])
  const [isEditingData, setIsEditingData] = useState(false)
  const [dataFields, setDataFields] = useState<Record<string, string>>({})
  const [decodedFields, setDecodedFields] = useState<Record<string, boolean>>({})

  // Modal states
  const [isSaveYamlModalOpen, setIsSaveYamlModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  useEffect(() => {
    if (cluster && namespace && secretName) {
      fetchSecretDetails()
    }
  }, [cluster, namespace, secretName])

  const fetchSecretDetails = async () => {
    try {
      setIsLoading(true)
      const [secretRes, eventsRes] = await Promise.all([
        api.get(`/clusters/${cluster}/namespaces/${namespace}/secrets/${secretName}`),
        api.get(`/clusters/${cluster}/events`).catch(() => ({ data: { events: [] } })),
      ])

      const secretData = secretRes.data
      const eventsData = eventsRes.data.events || []

      setSecret(secretData)
      
      // Initialize data fields
      if (secretData.data) {
        setDataFields({ ...secretData.data })
        // Initialize all fields as encoded (not decoded)
        const initialDecoded: Record<string, boolean> = {}
        Object.keys(secretData.data).forEach(key => {
          initialDecoded[key] = false
        })
        setDecodedFields(initialDecoded)
        
        // Parse ALL TLS certificates
        if (secretData.type === 'kubernetes.io/tls' || secretData.type === 'Opaque') {
          parseAllTLSCertificates(secretData.data)
        }
      }
      
      // Filter events related to this secret
      const secretEvents = eventsData.filter((event: any) => {
        if (!secretName) return false
        
        const involvedObjectMatch = event.involvedObject?.kind === 'Secret' && 
                                    event.involvedObject?.name === secretName &&
                                    event.involvedObject?.namespace === namespace
        const messageMatch = event.message?.toLowerCase().includes(secretName.toLowerCase())
        
        return involvedObjectMatch || messageMatch
      })
      
      setEvents(secretEvents)
      
      // Format as Kubernetes manifest
      const k8sManifest = {
        apiVersion: secretData.apiVersion || 'v1',
        kind: secretData.kind || 'Secret',
        metadata: secretData.metadata,
        type: secretData.type,
        data: secretData.data,
      }
      setYamlContent(yaml.dump(k8sManifest, { indent: 2, lineWidth: -1, sortKeys: false }))
    } catch (error) {
      console.error('Failed to fetch secret details:', error)
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch secret details',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const toggleDecode = (key: string) => {
    setDecodedFields(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleFieldChange = (key: string, value: string) => {
    setDataFields(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const base64Encode = (str: string): string => {
    try {
      return btoa(str)
    } catch (e) {
      return str
    }
  }

  const handleSaveData = async () => {
    try {
      // Ensure all fields are base64 encoded before saving
      const encodedData: Record<string, string> = {}
      Object.entries(dataFields).forEach(([key, value]) => {
        // If field is decoded, encode it back
        if (decodedFields[key]) {
          encodedData[key] = base64Encode(value)
        } else {
          encodedData[key] = value
        }
      })

      const updatedSecret = {
        ...secret,
        data: encodedData
      }

      await api.put(`/clusters/${cluster}/namespaces/${namespace}/secrets/${secretName}`, updatedSecret)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Secret data updated successfully',
      })
      setIsEditingData(false)
      fetchSecretDetails()
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update secret data: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleCancelEdit = () => {
    // Reset to original data
    if (secret?.data) {
      setDataFields({ ...secret.data })
      const initialDecoded: Record<string, boolean> = {}
      Object.keys(secret.data).forEach(key => {
        initialDecoded[key] = false
      })
      setDecodedFields(initialDecoded)
    }
    setIsEditingData(false)
  }

  const decodeBase64 = (encoded: string): string => {
    try {
      return atob(encoded)
    } catch (e) {
      return '[Invalid base64]'
    }
  }

  const parseAllTLSCertificates = (data: Record<string, string>) => {
    const certInfos: TLSCertInfo[] = []
    
    // Common certificate field names
    const certFields = ['tls.crt', 'ca.crt', 'cert.pem', 'certificate.crt', 'server.crt', 'client.crt']
    
    // Parse all fields that look like certificates
    for (const [key, value] of Object.entries(data)) {
      // Check if the key ends with .crt, .pem, or contains 'cert' or 'ca'
      const lowerKey = key.toLowerCase()
      if (
        lowerKey.endsWith('.crt') || 
        lowerKey.endsWith('.pem') || 
        lowerKey.includes('cert') || 
        lowerKey.includes('ca.') ||
        certFields.includes(key)
      ) {
        try {
          const pemCert = decodeBase64(value)
          // Check if it looks like a certificate (starts with -----BEGIN CERTIFICATE-----)
          if (pemCert.includes('-----BEGIN CERTIFICATE-----')) {
            const certInfo = parsePEMCertificate(pemCert, key)
            if (certInfo) {
              certInfos.push(certInfo)
            }
          }
        } catch (error) {
          console.error(`Failed to parse certificate ${key}:`, error)
        }
      }
    }
    
    setTlsCertInfos(certInfos)
  }

  const parsePEMCertificate = (pemCert: string, fieldName: string): TLSCertInfo | null => {
    try {
      // Use jsrsasign to parse the certificate
      const x509 = new jsrsasign.X509()
      x509.readCertPEM(pemCert)
      
      // Extract subject CN
      const subjectString = x509.getSubjectString()
      const subjectCN = extractCNFromDN(subjectString) || 'Unknown'
      
      // Extract issuer CN
      const issuerString = x509.getIssuerString()
      const issuerCN = extractCNFromDN(issuerString) || 'Unknown'
      
      // Extract serial number
      const serialHex = x509.getSerialNumberHex()
      const serialNumber = formatSerialNumber(serialHex)
      
      // Extract validity dates
      const notBefore = x509.getNotBefore()
      const notAfter = x509.getNotAfter()
      
      // Convert to ISO dates
      const notBeforeDate = parseJsrsasignDate(notBefore)
      const notAfterDate = parseJsrsasignDate(notAfter)
      
      const now = new Date()
      const isExpired = now > notAfterDate
      const daysUntilExpiry = Math.floor((notAfterDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      return {
        fieldName: fieldName,
        commonName: subjectCN,
        issuer: issuerCN,
        serialNumber: serialNumber,
        notBefore: notBeforeDate.toISOString(),
        notAfter: notAfterDate.toISOString(),
        isExpired,
        daysUntilExpiry
      }
    } catch (error) {
      console.error('Error parsing PEM certificate:', error)
      return null
    }
  }

  const extractCNFromDN = (dn: string): string | null => {
    // DN format from jsrsasign: "/C=US/ST=CA/O=Org/CN=example.com"
    const cnMatch = dn.match(/\/CN=([^/]+)/)
    return cnMatch ? cnMatch[1] : null
  }

  const formatSerialNumber = (hex: string): string => {
    // Format hex string as colon-separated pairs
    return hex.match(/.{1,2}/g)?.join(':').toUpperCase() || hex
  }

  const parseJsrsasignDate = (dateStr: string): Date => {
    // jsrsasign returns dates in format: YYMMDDhhmmssZ or YYYYMMDDhhmmssZ
    try {
      let year, month, day, hour, minute, second
      
      if (dateStr.length === 13) {
        // YYMMDDhhmmssZ format
        year = parseInt('20' + dateStr.substring(0, 2))
        month = parseInt(dateStr.substring(2, 4)) - 1
        day = parseInt(dateStr.substring(4, 6))
        hour = parseInt(dateStr.substring(6, 8))
        minute = parseInt(dateStr.substring(8, 10))
        second = parseInt(dateStr.substring(10, 12))
      } else if (dateStr.length === 15) {
        // YYYYMMDDhhmmssZ format
        year = parseInt(dateStr.substring(0, 4))
        month = parseInt(dateStr.substring(4, 6)) - 1
        day = parseInt(dateStr.substring(6, 8))
        hour = parseInt(dateStr.substring(8, 10))
        minute = parseInt(dateStr.substring(10, 12))
        second = parseInt(dateStr.substring(12, 14))
      } else {
        throw new Error('Unknown date format')
      }
      
      return new Date(Date.UTC(year, month, day, hour, minute, second))
    } catch (error) {
      console.error('Error parsing date:', error)
      return new Date()
    }
  }

  const handleSaveYaml = async () => {
    try {
      const updatedManifest = yaml.load(yamlContent)
      await api.put(`/clusters/${cluster}/namespaces/${namespace}/secrets/${secretName}`, updatedManifest)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Secret updated successfully',
      })
      fetchSecretDetails()
      setIsSaveYamlModalOpen(false)
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to update secret: ${error.message || 'Unknown error'}`,
      })
    }
  }

  const handleDeleteSecret = async () => {
    try {
      await api.delete(`/clusters/${cluster}/namespaces/${namespace}/secrets/${secretName}`)
      addNotification({
        type: 'success',
        title: 'Success',
        message: 'Secret deleted successfully',
      })
      setIsDeleteModalOpen(false)
      window.history.back()
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to delete secret: ${error.message || 'Unknown error'}`,
      })
    }
  }

  // Event columns
  const eventColumns = useMemo<Column<any>[]>(() => [
    {
      key: 'type',
      header: 'Type',
      accessor: (event) => (
        <span className={clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full',
          event.type === 'Normal'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        )}>
          {event.type || 'Unknown'}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.type || '',
      searchValue: (event) => event.type || '',
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (event) => (
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {event.reason || '-'}
        </span>
      ),
      sortable: true,
      sortValue: (event) => event.reason || '',
      searchValue: (event) => event.reason || '',
    },
    {
      key: 'message',
      header: 'Message',
      accessor: (event) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {event.message || '-'}
        </span>
      ),
      sortable: false,
      searchValue: (event) => event.message || '',
    },
    {
      key: 'age',
      header: 'Age',
      accessor: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        if (!timestamp) return <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
        return (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {formatAge(timestamp)}
          </span>
        )
      },
      sortable: true,
      sortValue: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        if (!timestamp) return 0
        return new Date(timestamp).getTime()
      },
      searchValue: (event) => {
        const timestamp = event.lastTimestamp || event.firstTimestamp
        return timestamp ? formatAge(timestamp) : ''
      },
    },
  ], [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!secret) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Secret not found</p>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'yaml', label: 'YAML' },
    { id: 'events', label: 'Events' },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      <Breadcrumb
        items={[
          { name: cluster || '', href: `/clusters/${cluster}` },
          { name: namespace || '', href: `/clusters/${cluster}/namespaces/${namespace}/secrets` },
          { name: 'Secrets', href: `/clusters/${cluster}/namespaces/${namespace}/secrets` },
          { name: secretName || '' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <KeyIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text">
              {secretName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Secret Details
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete"
          >
            <TrashIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Secret Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Secret Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{secret.metadata.name}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Namespace:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{secret.metadata.namespace}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Type:</span>
                  <p className="text-sm font-medium font-mono text-gray-900 dark:text-white">{secret.type}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Age:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatAge(secret.metadata.creationTimestamp)}
                  </p>
                </div>
              </div>

              {/* Labels */}
              {secret.metadata.labels && Object.keys(secret.metadata.labels).length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => toggleSection('labels')}
                    className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {expandedSections.labels ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Labels ({Object.keys(secret.metadata.labels).length})
                  </button>
                  {expandedSections.labels && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(secret.metadata.labels).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{key}</span>
                            <span className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-blue-200 dark:border-blue-700">
                              {value as string}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Annotations */}
              {secret.metadata.annotations && Object.keys(secret.metadata.annotations).length > 0 && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleSection('annotations')}
                    className="flex items-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                  >
                    {expandedSections.annotations ? (
                      <ChevronUpIcon className="w-4 h-4" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4" />
                    )}
                    Annotations ({Object.keys(secret.metadata.annotations).length})
                  </button>
                  {expandedSections.annotations && (
                    <div className="mt-3 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800 max-h-60 overflow-y-auto">
                      <div className="space-y-3">
                        {Object.entries(secret.metadata.annotations).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">{key}</span>
                            <p className="text-sm font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded border border-purple-200 dark:border-purple-700 break-all">
                              {value as string}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TLS Certificate Information */}
            {(secret.type === 'kubernetes.io/tls' || secret.type === 'Opaque') && tlsCertInfos.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    TLS Certificate Information
                  </h3>
                  <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                    {tlsCertInfos.length} certificate{tlsCertInfos.length > 1 ? 's' : ''}
                  </span>
                </div>
                {tlsCertInfos.map((certInfo, index) => (
                  <div 
                    key={index} 
                    className={clsx(
                      'rounded-lg p-4 space-y-3 border',
                      certInfo.isExpired 
                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                        : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                        {certInfo.fieldName}
                      </h4>
                      {certInfo.isExpired && (
                        <span className="px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded">
                          EXPIRED
                        </span>
                      )}
                      {!certInfo.isExpired && certInfo.daysUntilExpiry < 30 && certInfo.daysUntilExpiry >= 0 && (
                        <span className="px-2 py-1 text-xs font-semibold text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                          EXPIRES SOON ({certInfo.daysUntilExpiry}d)
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-600 dark:text-green-400 font-medium">Common Name (CN):</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {certInfo.commonName}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 font-medium">Issuer:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {certInfo.issuer}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 font-medium">Serial Number:</span>
                        <p className="font-mono text-xs text-gray-900 dark:text-white mt-1 break-all">
                          {certInfo.serialNumber}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-600 dark:text-green-400 font-medium">Not Before:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1 text-xs">
                          {new Date(certInfo.notBefore).toLocaleString(undefined, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                            timeZoneName: 'short'
                          })}
                        </p>
                      </div>
                      <div className="col-span-1 md:col-span-2">
                        <span className="text-green-600 dark:text-green-400 font-medium">Expires:</span>
                        <p className={clsx(
                          'font-medium mt-1 text-xs',
                          certInfo.isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        )}>
                          {new Date(certInfo.notAfter).toLocaleString(undefined, {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false,
                            timeZoneName: 'short'
                          })}
                          {!certInfo.isExpired && certInfo.daysUntilExpiry >= 0 && (
                            <span className={clsx(
                              'ml-2',
                              certInfo.daysUntilExpiry < 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'
                            )}>
                              ({certInfo.daysUntilExpiry} days remaining)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Data */}
            {Object.keys(dataFields).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Data ({Object.keys(dataFields).length} keys)
                  </h3>
                  {!isEditingData ? (
                    <button
                      onClick={() => setIsEditingData(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit Data
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      >
                        <XMarkIcon className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveData}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        <CheckIcon className="w-4 h-4" />
                        Save Changes
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {Object.entries(dataFields).map(([key, value]) => {
                    const isDecoded = decodedFields[key]
                    const displayValue = isDecoded ? decodeBase64(value) : value
                    
                    return (
                      <div key={key} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{key}</span>
                          <button
                            onClick={() => toggleDecode(key)}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded transition-colors"
                            title={isDecoded ? 'Show encoded' : 'Decode base64'}
                          >
                            {isDecoded ? (
                              <>
                                <EyeSlashIcon className="h-3 w-3" />
                                Encoded
                              </>
                            ) : (
                              <>
                                <EyeIcon className="h-3 w-3" />
                                Decode
                              </>
                            )}
                          </button>
                        </div>
                        <textarea
                          value={displayValue}
                          onChange={(e) => {
                            if (isDecoded) {
                              // If decoded, update with new decoded value
                              handleFieldChange(key, base64Encode(e.target.value))
                            } else {
                              handleFieldChange(key, e.target.value)
                            }
                          }}
                          disabled={!isEditingData}
                          rows={Math.min(Math.max(displayValue.split('\n').length, 3), 10)}
                          className={clsx(
                            'w-full px-3 py-2 border rounded-lg font-mono text-xs',
                            isEditingData
                              ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                              : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                          )}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'yaml' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">YAML Manifest</h3>
              <button
                onClick={() => setIsSaveYamlModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
            <YamlEditor 
              value={yamlContent} 
              onChange={(value) => setYamlContent(value)} 
              readOnly={false}
            />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <DataTable
              data={events}
              columns={eventColumns}
              keyExtractor={(event) => `${event.metadata?.uid || event.involvedObject?.uid}-${event.lastTimestamp}`}
              searchPlaceholder="Search events..."
              emptyMessage="No events found for this secret"
              pageSize={20}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {secret && (
        <>
          <ConfirmationModal
            isOpen={isSaveYamlModalOpen}
            onClose={() => setIsSaveYamlModalOpen(false)}
            onConfirm={handleSaveYaml}
            title="Save YAML Changes"
            message="Are you sure you want to save the YAML changes? This will update the secret."
            confirmText="Save"
            type="warning"
          />

          <ConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={handleDeleteSecret}
            title="Delete Secret"
            message={`Are you sure you want to delete secret "${secretName}"? This action cannot be undone.`}
            confirmText="Delete"
            type="danger"
          />
        </>
      )}
    </div>
  )
}

