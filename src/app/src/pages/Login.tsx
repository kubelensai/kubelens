import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '@/services/api'
import { useAuthStore } from '@/stores/authStore'
import { getSafeRedirectUrl } from '@/utils/navigation'
import { generateCodeVerifier, generateCodeChallenge, generateState, storePKCEParams, getPKCEParams, clearPKCEParams, validateState } from '@/utils/pkce'
import { getBackendUrl } from '@/config/env'
import MFASetupModal from '@/components/MFASetupModal'
import MFAVerification from '@/components/MFAVerification'
import { 
  CubeIcon, 
  EnvelopeIcon, 
  LockClosedIcon, 
  EyeIcon, 
  EyeSlashIcon,
  ArrowRightIcon,
  SunIcon,
  MoonIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'

type LoginStep = 'credentials' | 'mfa' | 'mfa-setup'

// SSO Provider types
interface SSOProvider {
  id: string
  type: string
  name: string
}

interface SSOProvidersResponse {
  enabled: boolean
  providers: SSOProvider[]
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials')
  const [mfaError, setMfaError] = useState('')
  const [showMFASetup, setShowMFASetup] = useState(false)
  
  // OAuth callback handling state
  const [oauthProcessing, setOauthProcessing] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [errorModalMessage, setErrorModalMessage] = useState('')
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useAuthStore()

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setDarkMode(true)
      document.documentElement.classList.add('dark')
    } else {
      setDarkMode(false)
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
    if (!darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  // Handle OAuth callback when redirected back from Dex
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (code && state) {
      handleOAuthCallback(code, state)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OAuth callback from Dex
  const handleOAuthCallback = async (code: string, urlState: string) => {
    setOauthProcessing(true)
    setMfaError('')
    
    // 1. Validate state (CSRF protection)
    if (!validateState(urlState)) {
      console.error('[Login] OAuth state mismatch - possible CSRF attack')
      setMfaError('Security error: Invalid state parameter. Please try again.')
      clearPKCEParams()
      navigate('/login', { replace: true })
      setOauthProcessing(false)
      return
    }
    
    // 2. Get PKCE code verifier
    const { codeVerifier } = getPKCEParams()
    if (!codeVerifier) {
      console.error('[Login] Missing PKCE code verifier')
      setMfaError('Session expired. Please try signing in again.')
      navigate('/login', { replace: true })
      setOauthProcessing(false)
      return
    }
    
    // 3. Clear PKCE params immediately
    clearPKCEParams()
    
    try {
      // 4. Exchange code for token
      console.log('[Login] Exchanging OAuth code for token...')
      const response = await api.post('/auth/oauth/exchange', {
        code,
        code_verifier: codeVerifier,
        redirect_uri: window.location.origin + '/login',
      })
      
      const { token, user, is_new_user } = response.data
      
      if (!token || !user) {
        throw new Error('Invalid response from server')
      }
      
      console.log('[Login] OAuth login successful:', { email: user.email, isNewUser: is_new_user })
      
      // 5. Store auth
      login(token, user)
      
      // 6. Clear URL params and show success popup
      navigate('/login', { replace: true })
      setShowSuccessPopup(true)
      
      // 7. Redirect after 2 seconds
      setTimeout(() => {
        const destination = getSafeRedirectUrl(searchParams)
        navigate(destination, { replace: true })
      }, 2000)
      
    } catch (err: any) {
      console.error('[Login] OAuth token exchange failed:', err)
      
      // Clear URL params
      navigate('/login', { replace: true })
      
      const errorMessage = err.response?.data?.error || 'Authentication failed. Please try again.'
      
      // Check if user is disabled (403 Forbidden)
      if (errorMessage.includes('disabled') || err.response?.status === 403) {
        setErrorModalMessage(errorMessage)
        setShowErrorModal(true)
      } else {
        setMfaError(errorMessage)
      }
    } finally {
      setOauthProcessing(false)
    }
  }

  // Check if OAuth2 SSO is available (public endpoint - no auth required)
  const { data: ssoData } = useQuery<SSOProvidersResponse>({
    queryKey: ['auth', 'sso', 'providers'],
    queryFn: async () => {
      try {
        const response = await api.get('/auth/sso/providers')
        return response.data
      } catch {
        // SSO not available - this is expected if extension is not installed
        return { enabled: false, providers: [] }
      }
    },
    retry: false, // Don't retry if endpoint fails
    staleTime: 60000, // Cache for 1 minute
  })

  // Check if OAuth2 SSO is available
  const ssoEnabled = ssoData?.enabled === true && ssoData?.providers?.length > 0
  const ssoProviders = ssoData?.providers || []

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string; mfa_token?: string }) => {
      const response = await api.post('/auth/signin', credentials)
      return response.data
    },
    onSuccess: (data) => {
      if (data.mfa_required) {
        // MFA token required
        setLoginStep('mfa')
        setMfaError('')
      } else if (data.mfa_setup_required) {
        // MFA setup required
        // Set temp token for MFA setup API calls
        localStorage.setItem('token', data.temp_token)
        setShowMFASetup(true)
      } else {
        // Login successful
        login(data.token, data.user)
        
        // Get intended destination from redirect parameter
        const destination = getSafeRedirectUrl(searchParams)
        console.log('[Login] Success! Redirecting to:', destination)
        
        navigate(destination, { replace: true })
      }
    },
    onError: (error: any) => {
      setMfaError(error.response?.data?.error || 'Login failed')
    }
  })

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMfaError('')
    loginMutation.mutate({ email, password })
  }

  const handleMFAVerify = (token: string) => {
    setMfaError('')
    loginMutation.mutate({ email, password, mfa_token: token })
  }

  const handleMFASetupSuccess = () => {
    setShowMFASetup(false)
    // After MFA setup, login again
    loginMutation.mutate({ email, password })
  }

  // Handle SSO sign-in for a specific provider
  const handleSSOSignin = async (providerId?: string) => {
    try {
      // 1. Generate PKCE parameters
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      const state = generateState()

      // 2. Store PKCE params for callback verification
      storePKCEParams(codeVerifier, state)

      // 3. Build authorization URL with PKCE
      // redirect_uri points back to /login to handle the callback directly
      const params = new URLSearchParams({
        client_id: 'kubelens',
        redirect_uri: `${window.location.origin}/login`,
        response_type: 'code',
        scope: 'openid profile email groups',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state,
      })

      // 4. Redirect to Dex on backend server
      // If providerId is specified, redirect directly to the provider's auth endpoint
      // Otherwise, Dex will show the provider selection page
      const backendUrl = getBackendUrl()
      console.log('[Login] Starting SSO with PKCE flow, backend:', backendUrl, 'provider:', providerId)
      
      if (providerId) {
        // Redirect directly to specific provider
        window.location.href = `${backendUrl}/dex/auth/${providerId}?${params.toString()}`
      } else {
        // Let Dex show provider selection
        window.location.href = `${backendUrl}/dex/auth?${params.toString()}`
      }
    } catch (error) {
      console.error('Failed to start SSO sign-in:', error)
    }
  }

  // Get SSO button icon based on connector type
  const getSSOIcon = (connectorType: string) => {
    switch (connectorType) {
      case 'google':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )
      case 'github':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        )
      case 'gitlab':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" fill="#E24329"/>
          </svg>
        )
      case 'microsoft':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#f25022" d="M1 1h10v10H1z"/>
            <path fill="#00a4ef" d="M1 13h10v10H1z"/>
            <path fill="#7fba00" d="M13 1h10v10H13z"/>
            <path fill="#ffb900" d="M13 13h10v10H13z"/>
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        )
    }
  }

  return (
    <div className="min-h-screen flex relative">
      {/* Dark Mode Toggle - Fixed Position */}
      <button
        onClick={toggleDarkMode}
        className="fixed top-6 right-6 z-50 p-3 rounded-full bg-white/10 dark:bg-gray-800/50 backdrop-blur-md border border-white/20 dark:border-gray-700 hover:bg-white/20 dark:hover:bg-gray-700/50 transition-all shadow-lg hover:shadow-xl group"
        aria-label="Toggle dark mode"
      >
        {darkMode ? (
          <SunIcon className="h-5 w-5 text-yellow-400 group-hover:text-yellow-300 transition-colors" />
        ) : (
          <MoonIcon className="h-5 w-5 text-gray-700 group-hover:text-gray-900 transition-colors" />
        )}
      </button>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 relative overflow-hidden">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary-400/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-primary-500/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary-300/30 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl">
              <CubeIcon className="h-10 w-10" />
            </div>
            <h1 className="text-4xl font-bold">Kubelens</h1>
          </div>
          <h2 className="text-3xl font-bold mb-4">
            Modern Kubernetes<br />Management Platform
          </h2>
          <p className="text-lg text-primary-100 leading-relaxed mb-8">
            Secure, powerful, and intuitive cluster management with multi-factor authentication.
          </p>
          <div className="space-y-3 text-primary-100">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary-300 rounded-full" />
              <span>Multi-cluster support</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary-300 rounded-full" />
              <span>Real-time monitoring</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-primary-300 rounded-full" />
              <span>Enhanced security with 2FA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
              <CubeIcon className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kubelens</h1>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
            {loginStep === 'credentials' ? (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Welcome back
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Sign in to your account to continue
                  </p>
                </div>

                {/* Error Message */}
                {(loginMutation.isError || mfaError) && (
                  <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {mfaError || loginMutation.error?.response?.data?.error || 'Invalid email or password'}
                    </p>
                  </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleCredentialsSubmit} className="space-y-5">
                  {/* Email Field */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        required
                        disabled={loginMutation.isPending}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LockClosedIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        required
                        disabled={loginMutation.isPending}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                      Remember me
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loginMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-medium py-3 px-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loginMutation.isPending ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign in</span>
                        <ArrowRightIcon className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* SSO Sign In - Only show if OAuth2 extension is enabled with providers */}
                {ssoEnabled && ssoProviders.length > 0 && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                          Or continue with
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {ssoProviders.map((provider) => (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => handleSSOSignin(provider.id)}
                          className="w-full flex items-center justify-center gap-3 bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-3 px-4 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 shadow-sm hover:shadow"
                        >
                          {getSSOIcon(provider.type)}
                          <span>{provider.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <MFAVerification 
                onVerify={handleMFAVerify}
                loading={loginMutation.isPending}
                error={mfaError}
              />
            )}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-gray-500 dark:text-gray-500">
            © 2025 Kubelens. All rights reserved.
          </p>
        </div>
      </div>

      {/* MFA Setup Modal */}
      <MFASetupModal 
        isOpen={showMFASetup}
        onClose={() => {}}
        onSuccess={handleMFASetupSuccess}
      />

      {/* OAuth Processing Overlay */}
      {oauthProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-sm mx-4 text-center">
            <div className="flex justify-center mb-4">
              <CubeIcon className="h-12 w-12 text-primary-600 dark:text-primary-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Authenticating...
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we complete your sign-in.
            </p>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-sm mx-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-full">
                <CheckCircleIcon className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Login Successful!
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Redirecting to dashboard...
            </p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-600"></div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal - Account Disabled */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-sm mx-4 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
                <ExclamationTriangleIcon className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Account Disabled
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {errorModalMessage}
            </p>
            <button
              onClick={() => setShowErrorModal(false)}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
