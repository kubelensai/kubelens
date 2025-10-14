import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, KeyIcon, CheckIcon, EyeIcon, EyeSlashIcon, ShieldCheckIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { formatAge } from '@/utils/format'
import api from '@/services/api'
import { notifyResourceAction } from '@/utils/notifications'
import * as jsrsasign from 'jsrsasign'

interface SecretDetailsModalProps {
  secret: any
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

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

export default function SecretDetailsModal({ secret, isOpen, onClose, onSuccess }: SecretDetailsModalProps) {
  const [dataFields, setDataFields] = useState<Record<string, string>>({})
  const [decodedFields, setDecodedFields] = useState<Record<string, boolean>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [tlsCertInfos, setTlsCertInfos] = useState<TLSCertInfo[]>([])

  // Initialize data fields when secret changes
  useEffect(() => {
    if (secret?.data) {
      // Secret data is base64 encoded
      setDataFields({ ...secret.data })
      // Initialize all fields as encoded (not decoded)
      const initialDecoded: Record<string, boolean> = {}
      Object.keys(secret.data).forEach(key => {
        initialDecoded[key] = false
      })
      setDecodedFields(initialDecoded)
      
      // Parse ALL TLS certificates if this is a TLS secret
      if (secret.type === 'kubernetes.io/tls') {
        parseAllTLSCertificates(secret.data)
      }
    }
  }, [secret])

  if (!secret) return null

  const base64Decode = (str: string): string => {
    try {
      return atob(str)
    } catch (e) {
      return 'Error decoding base64'
    }
  }

  const base64Encode = (str: string): string => {
    try {
      return btoa(str)
    } catch (e) {
      return str
    }
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

  const parseAllTLSCertificates = async (data: Record<string, string>) => {
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
          const pemCert = base64Decode(value)
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

  const handleSave = async () => {
    setIsSaving(true)
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

      await api.put(
        `/clusters/${secret.clusterName}/namespaces/${secret.metadata.namespace}/secrets/${secret.metadata.name}`,
        updatedSecret
      )

      notifyResourceAction.updated('Secret', secret.metadata.name)
      setIsEditing(false)
      onSuccess()
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error'
      notifyResourceAction.failed('update', 'Secret', secret.metadata.name, errorMsg)
      console.error('Failed to update secret:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    // Reset to original data
    if (secret?.data) {
      setDataFields({ ...secret.data })
      const initialDecoded: Record<string, boolean> = {}
      Object.keys(secret.data).forEach(key => {
        initialDecoded[key] = false
      })
      setDecodedFields(initialDecoded)
    }
    setIsEditing(false)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white dark:bg-[#1a1f2e] shadow-2xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <KeyIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    Secret: {secret.metadata.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {/* Basic Info */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Name:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {secret.metadata.name}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Namespace:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {secret.metadata.namespace}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Type:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {secret.type}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Age:</span>
                        <p className="font-medium text-gray-900 dark:text-white mt-1">
                          {formatAge(secret.metadata.creationTimestamp)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Data Fields */}
                  {Object.keys(dataFields).length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          Data Fields
                        </h3>
                        {!isEditing ? (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                          >
                            Edit Data Fields
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSave}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isSaving ? (
                                <>
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <CheckIcon className="h-4 w-4" />
                                  Save Changes
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        {Object.entries(dataFields).map(([key, value]) => {
                          const isDecoded = decodedFields[key]
                          const displayValue = isDecoded ? base64Decode(value) : value
                          
                          return (
                            <div key={key} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                  {key}
                                </label>
                                <button
                                  onClick={() => toggleDecode(key)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded transition-colors"
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
                                disabled={!isEditing}
                                rows={Math.min(Math.max(displayValue.split('\n').length, 3), 10)}
                                className={`w-full px-3 py-2 border rounded-lg font-mono text-xs ${
                                  isEditing
                                    ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'
                                    : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                                }`}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* TLS Certificate Info */}
                  {secret.type === 'kubernetes.io/tls' && tlsCertInfos.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-2">
                        <ShieldCheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                        TLS Certificate Information
                        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                          {tlsCertInfos.length} certificate{tlsCertInfos.length > 1 ? 's' : ''}
                        </span>
                      </h3>
                      {tlsCertInfos.map((certInfo, index) => (
                        <div 
                          key={index} 
                          className={`rounded-lg p-4 space-y-3 border ${
                            certInfo.isExpired 
                              ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' 
                              : 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide flex items-center gap-2">
                              <DocumentTextIcon className="h-4 w-4" />
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
                          <div className="grid grid-cols-2 gap-4 text-sm">
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
                                {new Date(certInfo.notBefore).toLocaleString()}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <span className="text-green-600 dark:text-green-400 font-medium">Expires:</span>
                              <p className={`font-medium mt-1 text-xs ${certInfo.isExpired ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                                {new Date(certInfo.notAfter).toLocaleString()}
                                {!certInfo.isExpired && certInfo.daysUntilExpiry >= 0 && (
                                  <span className={`ml-2 ${certInfo.daysUntilExpiry < 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
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

                  {/* Labels */}
                  {secret.metadata.labels && Object.keys(secret.metadata.labels).length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
                        Labels
                      </h3>
                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(secret.metadata.labels).map(([key, value]) => (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              <span className="font-semibold">{key}</span>
                              <span className="mx-1">=</span>
                              <span>{value as string}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

