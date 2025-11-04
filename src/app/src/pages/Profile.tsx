import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { 
  UserIcon,
  EnvelopeIcon,
  KeyIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import MFASetupModal from '@/components/MFASetupModal'

export default function Profile() {
  const { updateUser } = useAuthStore()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    avatar_url: '',
  })
  
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')
  const [showMFASetup, setShowMFASetup] = useState(false)
  const [showDisableMFAModal, setShowDisableMFAModal] = useState(false)
  const [mfaToken, setMfaToken] = useState('')

  // Fetch current user data
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const response = await api.get('/auth/me')
      return response.data
    },
  })

  // Initialize form with current user data
  useEffect(() => {
    if (currentUser) {
      setFormData({
        username: currentUser.username || '',
        full_name: currentUser.full_name || '',
        avatar_url: currentUser.avatar_url || '',
      })
    }
  }, [currentUser])

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.patch('/auth/profile', data)
      return response.data
    },
    onSuccess: (data) => {
      // Update auth store with new user data
      if (data.user) {
        updateUser(data.user)
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      
      // Show success message
      setSuccessMessage('Profile updated successfully!')
      setErrors({})
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to update profile'
      setErrors({ submit: errorMessage })
      setSuccessMessage('')
    },
  })

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const response = await api.post('/auth/change-password', data)
      return response.data
    },
    onSuccess: () => {
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
      setSuccessMessage('Password changed successfully!')
      setErrors({})
      
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to change password'
      setErrors({ password: errorMessage })
      setSuccessMessage('')
    },
  })

  // Disable MFA mutation
  const disableMFAMutation = useMutation({
    mutationFn: async (token: string) => {
      await api.post('/auth/mfa/disable', { token })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      setSuccessMessage('MFA disabled successfully!')
      setShowDisableMFAModal(false)
      setMfaToken('')
      setTimeout(() => setSuccessMessage(''), 3000)
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || 'Failed to disable MFA'
      setErrors({ mfa: errorMessage })
    },
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccessMessage('')

    // Validation
    const newErrors: Record<string, string> = {}
    
    if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    updateProfileMutation.mutate(formData)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSuccessMessage('')

    // Validation
    const newErrors: Record<string, string> = {}
    
    if (!passwordData.current_password) {
      newErrors.current_password = 'Current password is required'
    }
    
    if (passwordData.new_password.length < 8) {
      newErrors.new_password = 'Password must be at least 8 characters'
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    changePasswordMutation.mutate({
      current_password: passwordData.current_password,
      new_password: passwordData.new_password,
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <Breadcrumb items={[{ name: 'Profile' }]} />
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Your Profile</h1>
        <p className="mt-1 sm:mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
          <div className="flex">
            <CheckCircleIcon className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errors.submit && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 border border-red-200 dark:border-red-800">
          <div className="flex">
            <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {errors.submit}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Information Card */}
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary-500" />
              Profile Information
            </h2>
          </div>
          
          <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
            {/* Email (Read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <EnvelopeIcon className="h-4 w-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={currentUser?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email cannot be changed
              </p>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username *
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.username ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Enter username"
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.username}</p>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Enter full name"
              />
            </div>

            {/* Avatar URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Avatar URL
              </label>
              <input
                type="url"
                value={formData.avatar_url}
                onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="https://example.com/avatar.jpg"
              />
              {formData.avatar_url && (
                <div className="mt-2">
                  <img
                    src={formData.avatar_url}
                    alt="Avatar preview"
                    className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Auth Provider Badge */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Authentication Provider
              </label>
              <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                currentUser?.auth_provider === 'google'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {currentUser?.auth_provider || 'local'}
              </span>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={updateProfileMutation.isPending}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password Card */}
        {currentUser?.auth_provider === 'local' && (
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <KeyIcon className="h-5 w-5 text-primary-500" />
                Change Password
              </h2>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              {errors.password && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.password}</p>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Current Password *
                </label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.current_password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter current password"
                />
                {errors.current_password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.current_password}</p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.new_password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter new password"
                />
                {errors.new_password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.new_password}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Must be at least 8 characters
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.confirm_password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Confirm new password"
                />
                {errors.confirm_password && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.confirm_password}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MFA Section - Only for local auth */}
        {currentUser?.auth_provider === 'local' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-primary-500" />
                Two-Factor Authentication
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {errors.mfa && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.mfa}</p>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    MFA Status
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentUser?.mfa_enabled 
                      ? 'Two-factor authentication is enabled for your account.'
                      : 'Add an extra layer of security to your account.'}
                  </p>
                </div>
                <div className="ml-4">
                  {currentUser?.mfa_enabled ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      Disabled
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4">
                {currentUser?.mfa_enabled ? (
                  <button
                    onClick={() => setShowDisableMFAModal(true)}
                    className="btn-secondary"
                  >
                    Disable MFA
                  </button>
                ) : (
                  <button
                    onClick={() => setShowMFASetup(true)}
                    className="btn-primary"
                  >
                    Enable MFA
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MFA Setup Modal */}
      <MFASetupModal 
        isOpen={showMFASetup}
        onClose={() => setShowMFASetup(false)}
        onSuccess={() => {
          setShowMFASetup(false)
          queryClient.invalidateQueries({ queryKey: ['currentUser'] })
          setSuccessMessage('MFA enabled successfully!')
          setTimeout(() => setSuccessMessage(''), 3000)
        }}
      />

      {/* Disable MFA Modal - Custom */}
      {showDisableMFAModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => {
              setShowDisableMFAModal(false)
              setMfaToken('')
            }} />
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Disable Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your current MFA code to disable two-factor authentication.
              </p>
              {errors.mfa && (
                <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">{errors.mfa}</p>
                </div>
              )}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  MFA Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-2 text-center text-lg font-mono tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDisableMFAModal(false)
                    setMfaToken('')
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (mfaToken) {
                      disableMFAMutation.mutate(mfaToken)
                    }
                  }}
                  disabled={!mfaToken || mfaToken.length !== 6 || disableMFAMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg transition-colors"
                >
                  {disableMFAMutation.isPending ? 'Disabling...' : 'Disable MFA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

