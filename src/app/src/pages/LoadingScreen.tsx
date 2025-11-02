/**
 * LoadingScreen Component
 * 
 * Entry point for all app navigation. Handles authentication validation
 * and redirects users appropriately based on auth status.
 * 
 * Features:
 * - Beautiful animated loading UI
 * - Random Kubernetes tips (educational content)
 * - Progress bar animation
 * - Session expired messaging
 * - Redirect parameter preservation
 * - Mobile-first responsive design
 * 
 * @module pages/LoadingScreen
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CubeIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { getSafeRedirectUrl, createRedirectUrl } from '@/utils/navigation'
import { validateAndCorrectPath } from '@/utils/clusterFallback'
import { getRandomTip, type K8sTip } from '@/data/k8sTips'
import api from '@/services/api'

export default function LoadingScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { validateSession } = useAuthStore()

  // UI state
  const [progress, setProgress] = useState(0)
  const [currentTip, setCurrentTip] = useState<K8sTip>(getRandomTip())
  const [showSessionExpired, setShowSessionExpired] = useState(false)
  const [redirectCountdown, setRedirectCountdown] = useState(2)
  const [isDark, setIsDark] = useState(() => {
    // Initialize from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme')
    return savedTheme ? savedTheme === 'dark' : true // Default to dark theme
  })

  // Initialize and sync theme
  useEffect(() => {
    const initializeTheme = async () => {
      // Get theme from localStorage (instant)
      const savedTheme = localStorage.getItem('theme')
      const initialDark = savedTheme ? savedTheme === 'dark' : true
      
      console.log('[LoadingScreen] Initial theme from localStorage:', savedTheme || 'none (default: dark)')
      setIsDark(initialDark)
      
      // Apply theme to document immediately
      if (initialDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }

      // If user is authenticated, fetch and sync with session API
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const response = await api.get('/session')
          if (response.data?.selected_theme) {
            const sessionDark = response.data.selected_theme === 'dark'
            console.log('[LoadingScreen] Theme from session API:', response.data.selected_theme)
            
            // Update if different from localStorage
            if (sessionDark !== initialDark) {
              console.log('[LoadingScreen] Syncing theme to match session')
              setIsDark(sessionDark)
              localStorage.setItem('theme', response.data.selected_theme)
              
              // Apply to document
              if (sessionDark) {
                document.documentElement.classList.add('dark')
              } else {
                document.documentElement.classList.remove('dark')
              }
            }
          }
        } catch (error) {
          console.log('[LoadingScreen] Could not fetch session (not authenticated or error)')
          // Keep localStorage theme (or default dark)
        }
      } else {
        console.log('[LoadingScreen] Not authenticated, using default dark theme')
        // Ensure dark theme is saved for unauthenticated users
        if (!savedTheme) {
          localStorage.setItem('theme', 'dark')
        }
      }
    }
    
    initializeTheme()
  }, [])

  // Authentication check and redirect logic
  useEffect(() => {
    const checkAuth = async () => {
      console.log('[LoadingScreen] Starting authentication check...')
      const startTime = Date.now()

      // Smooth progress bar animation (0% -> 90% over 2 seconds)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev
          // Slower increment for smoother animation
          return Math.min(prev + 1, 90)
        })
      }, 22) // 90 steps * 22ms ≈ 2 seconds

      try {
        // Validate session with backend
        const result = await validateSession()

        // Complete progress
        clearInterval(progressInterval)
        setProgress(100)

        // Get intended destination from query param
        const intendedDestination = getSafeRedirectUrl(searchParams)
        console.log('[LoadingScreen] Intended destination:', intendedDestination)

        // Ensure minimum display time (1.5 seconds for better UX)
        const elapsed = Date.now() - startTime
        const minDisplayTime = 1500 // 1.5 seconds
        const remainingTime = Math.max(0, minDisplayTime - elapsed)

        if (remainingTime > 0) {
          console.log(`[LoadingScreen] Waiting ${remainingTime}ms for minimum display time...`)
          await new Promise((resolve) => setTimeout(resolve, remainingTime))
        }

        if (result.authenticated) {
          // ✅ User is authenticated - validate and correct path if needed
          console.log('[LoadingScreen] ✅ Authenticated, validating destination:', intendedDestination)

          // Validate cluster and namespace existence, fallback if needed
          const correctedPath = await validateAndCorrectPath(intendedDestination)
          
          if (correctedPath !== intendedDestination) {
            console.log('[LoadingScreen] ⚠️  Path corrected:', intendedDestination, '->', correctedPath)
          }

          // Small delay for smooth UX
          await new Promise((resolve) => setTimeout(resolve, 300))

          navigate(correctedPath, { replace: true })
        } else if (result.expired) {
          // ⚠️  Session expired - show message then redirect to login
          console.log('[LoadingScreen] ⚠️  Session expired, showing message')

          setShowSessionExpired(true)

          // Countdown timer
          const countdownInterval = setInterval(() => {
            setRedirectCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownInterval)
                return 0
              }
              return prev - 1
            })
          }, 1000)

          // Wait 2 seconds to show message
          await new Promise((resolve) => setTimeout(resolve, 2000))

          // Redirect to login with redirect param
          const loginUrl = createRedirectUrl('/login', intendedDestination)
          console.log('[LoadingScreen] Redirecting to:', loginUrl)
          navigate(loginUrl, { replace: true })
        } else {
          // ❌ No session - redirect to login
          console.log('[LoadingScreen] ❌ No session, redirecting to login')

          // Redirect to login with redirect param (if not default)
          const loginUrl =
            intendedDestination === '/dashboard'
              ? '/login'
              : createRedirectUrl('/login', intendedDestination)

          navigate(loginUrl, { replace: true })
        }
      } catch (error) {
        console.error('[LoadingScreen] Error during validation:', error)
        clearInterval(progressInterval)
        setProgress(100)

        // On error, redirect to login without redirect param
        navigate('/login', { replace: true })
      }
    }

    checkAuth()
  }, [navigate, searchParams, validateSession])

  // Rotate tips every 5 seconds (for long auth checks)
  useEffect(() => {
    const tipInterval = setInterval(() => {
      setCurrentTip(getRandomTip())
    }, 5000)

    return () => clearInterval(tipInterval)
  }, [])

  return (
    <div className={`flex items-center justify-center min-h-screen bg-gradient-to-br transition-colors px-4 ${
      isDark 
        ? 'from-gray-900 to-gray-800' 
        : 'from-gray-50 to-gray-100'
    }`}>
      <div className="flex flex-col items-center gap-6 sm:gap-8 max-w-md w-full">
        {/* Logo */}
        <div className="relative">
          {/* Outer glow ring */}
          <div className={`absolute inset-0 rounded-full blur-2xl animate-pulse ${
            isDark ? 'bg-primary-400/20' : 'bg-primary-500/20'
          }`} />

          {/* Logo container */}
          <div className={`relative bg-gradient-to-br p-4 sm:p-5 rounded-2xl shadow-2xl animate-float ${
            isDark 
              ? 'from-primary-400 to-primary-500' 
              : 'from-primary-500 to-primary-600'
          }`}>
            <CubeIcon className="h-12 w-12 sm:h-16 sm:w-16 text-white" />
          </div>
        </div>

        {/* Content */}
        {showSessionExpired ? (
          /* Session Expired Alert */
          <div className={`w-full border-2 rounded-xl p-4 sm:p-6 text-center animate-slide-in shadow-lg ${
            isDark 
              ? 'bg-yellow-900/20 border-yellow-800' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className={`text-xl sm:text-2xl font-bold mb-3 flex items-center justify-center gap-2 ${
              isDark ? 'text-yellow-400' : 'text-yellow-600'
            }`}>
              <span className="text-2xl">⚠️</span>
              <span>Session Expired</span>
            </div>
            <p className={`text-sm sm:text-base mb-4 ${
              isDark ? 'text-yellow-300' : 'text-yellow-700'
            }`}>
              Your session has expired. Redirecting to login...
            </p>
            <div className={`font-mono text-lg ${
              isDark ? 'text-yellow-400' : 'text-yellow-600'
            }`}>
              {redirectCountdown}s
            </div>
          </div>
        ) : (
          <>
            {/* Progress Bar */}
            <div className="w-full space-y-2">
              <div className={`h-2 rounded-full overflow-hidden shadow-inner ${
                isDark ? 'bg-gray-700' : 'bg-gray-200'
              }`}>
                <div
                  className="h-full bg-gradient-to-r from-primary-500 via-primary-600 to-primary-500 bg-[length:200%_100%] animate-shimmer transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className={`text-center text-xs sm:text-sm font-medium ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {progress}%
              </p>
            </div>

            {/* K8s Tip Card */}
            <div className={`w-full rounded-xl p-4 sm:p-6 shadow-xl border animate-fade-in ${
              isDark 
                ? 'bg-gray-800 border-gray-700' 
                : 'bg-white border-gray-200'
            }`}>
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 text-3xl sm:text-4xl animate-bounce-slow">
                  {currentTip.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className={`text-sm sm:text-base font-bold mb-2 ${
                    isDark ? 'text-primary-400' : 'text-primary-600'
                  }`}>
                    {currentTip.title}
                  </h3>
                  <p className={`text-xs sm:text-sm leading-relaxed ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    {currentTip.tip}
                  </p>
                </div>
              </div>

              {/* Category badge */}
              <div className={`mt-4 flex items-center justify-between text-xs ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}>
                <span className={`px-2 py-1 rounded-full capitalize ${
                  isDark ? 'bg-gray-700' : 'bg-gray-100'
                }`}>
                  {currentTip.category.replace('-', ' ')}
                </span>
                <span>Tip #{currentTip.id.split('-')[1]}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        .animate-float {
          animation: float 3s ease-in-out infinite;
        }

        .animate-shimmer {
          animation: shimmer 2s linear infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }

        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}

