import { useState } from 'react'
import { ShieldCheckIcon, KeyIcon } from '@heroicons/react/24/outline'

interface MFAVerificationProps {
  onVerify: (token: string) => void
  loading: boolean
  error: string
}

export default function MFAVerification({ onVerify, loading, error }: MFAVerificationProps) {
  const [token, setToken] = useState('')
  const [useBackupCode, setUseBackupCode] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (token.trim()) {
      onVerify(token.trim())
    }
  }

  const maxLength = useBackupCode ? 8 : 6

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
          {useBackupCode ? (
            <KeyIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          ) : (
            <ShieldCheckIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Two-Factor Authentication
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {useBackupCode 
            ? 'Enter one of your 8-character backup codes'
            : 'Enter the 6-digit code from your authenticator app'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            inputMode={useBackupCode ? 'text' : 'numeric'}
            pattern={useBackupCode ? '[A-Z0-9]*' : '[0-9]*'}
            maxLength={maxLength}
            value={token}
            onChange={(e) => {
              const value = useBackupCode 
                ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                : e.target.value.replace(/\D/g, '')
              setToken(value)
            }}
            placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
            className="w-full px-4 py-4 text-center text-2xl font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            autoFocus
            autoComplete="off"
          />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200 text-center">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || token.length !== maxLength}
          className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </button>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setUseBackupCode(!useBackupCode)
              setToken('')
            }}
            className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
          >
            {useBackupCode ? 'Use authenticator code instead' : 'Use backup code instead'}
          </button>
        </div>
      </form>
    </div>
  )
}

