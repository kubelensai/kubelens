import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { ShieldCheckIcon, DocumentDuplicateIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import api from '@/services/api'

interface MFASetupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function MFASetupModal({ isOpen, onSuccess }: MFASetupModalProps) {
  const [step, setStep] = useState<'setup' | 'verify'>('setup')
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSetup = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/mfa/setup')
      setSecret(response.data.secret)
      setQrCodeUrl(response.data.qr_code_url)
      setBackupCodes(response.data.backup_codes)
      setStep('verify')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to setup MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit code')
      return
    }

    setLoading(true)
    setError('')
    try {
      await api.post('/auth/mfa/enable', { token: verificationCode })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid verification code')
    } finally {
      setLoading(false)
    }
  }

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kubelens-backup-codes.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                      <ShieldCheckIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                      {step === 'setup' ? 'Set Up Two-Factor Authentication' : 'Verify Your Authenticator'}
                    </Dialog.Title>
                  </div>
                </div>

                {step === 'setup' ? (
                  <div className="space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Security Requirement:</strong> Two-factor authentication (2FA) is required for all accounts. 
                        You'll need an authenticator app like Google Authenticator, Authy, or 1Password.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Steps to set up:</h3>
                      <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
                        <li>Install an authenticator app on your mobile device</li>
                        <li>Click "Generate QR Code" below</li>
                        <li>Scan the QR code with your authenticator app</li>
                        <li>Enter the 6-digit code to verify</li>
                        <li>Save your backup codes in a safe place</li>
                      </ol>
                    </div>

                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={handleSetup}
                        disabled={loading}
                        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
                      >
                        {loading ? 'Generating...' : 'Generate QR Code'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* QR Code Section */}
                    <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                        Scan this QR code with your authenticator app
                      </p>
                      {qrCodeUrl && (
                        <img 
                          src={qrCodeUrl} 
                          alt="MFA QR Code" 
                          className="w-64 h-64 bg-white p-4 rounded-lg"
                        />
                      )}
                      <div className="text-center">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Or enter this code manually:</p>
                        <code className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm font-mono">
                          {secret}
                        </code>
                      </div>
                    </div>

                    {/* Backup Codes Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Backup Codes</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={copyBackupCodes}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title="Copy codes"
                          >
                            <DocumentDuplicateIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={downloadBackupCodes}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                            title="Download codes"
                          >
                            <ArrowDownTrayIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                          <strong>⚠️ Important:</strong> Save these backup codes in a safe place. 
                          Each code can only be used once if you lose access to your authenticator app.
                        </p>
                        <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                          {backupCodes.map((code, index) => (
                            <div key={index} className="px-3 py-2 bg-white dark:bg-gray-800 rounded border border-yellow-300 dark:border-yellow-700">
                              {code}
                            </div>
                          ))}
                        </div>
                      </div>
                      {copied && (
                        <p className="text-sm text-green-600 dark:text-green-400 text-center">✓ Copied to clipboard!</p>
                      )}
                    </div>

                    {/* Verification Section */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Enter the 6-digit code from your authenticator app
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={verificationCode}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '')
                          setVerificationCode(value)
                          setError('')
                        }}
                        placeholder="000000"
                        className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>

                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleVerify}
                        disabled={loading || verificationCode.length !== 6}
                        className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium rounded-lg transition-colors"
                      >
                        {loading ? 'Verifying...' : 'Verify and Enable'}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

