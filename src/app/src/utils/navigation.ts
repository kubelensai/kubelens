/**
 * Navigation Utility
 * 
 * Handles navigation intent preservation with security validation.
 * Prevents open redirect vulnerabilities following OWASP recommendations.
 * 
 * @module utils/navigation
 */

/**
 * Validates a redirect URL to prevent open redirect attacks
 * 
 * Security checks:
 * 1. Must be a relative path (starts with /)
 * 2. No protocol-based redirects (http://, https://, javascript:, data:)
 * 3. No protocol-relative redirects (//evil.com)
 * 4. No backslash bypasses (\\ or \/)
 * 5. No encoded slashes (%2F%2F)
 * 6. Blocked sensitive routes (/login, /logout, /)
 * 7. Must match allowed route patterns (whitelist)
 * 
 * @param url - The redirect URL to validate
 * @returns Validated URL or null if invalid
 */
export const validateRedirectUrl = (url: string | null): string | null => {
  if (!url) return null

  try {
    // Decode the URL
    const decoded = decodeURIComponent(url)

    // 1. Must start with / (relative path only)
    if (!decoded.startsWith('/')) {
      console.warn('[Security] Invalid redirect: must be relative path', decoded)
      return null
    }

    // 2. Prevent protocol-based redirects (http://, https://, javascript:, data:)
    if (decoded.includes(':')) {
      console.warn('[Security] Invalid redirect: contains protocol', decoded)
      return null
    }

    // 3. Prevent double-slash redirect (//evil.com)
    if (decoded.startsWith('//')) {
      console.warn('[Security] Invalid redirect: double slash', decoded)
      return null
    }

    // 4. Prevent backslash bypass (\\ or \/)
    if (decoded.includes('\\')) {
      console.warn('[Security] Invalid redirect: contains backslash', decoded)
      return null
    }

    // 5. Prevent encoded slashes (%2F%2F becomes //)
    const doubleEncodedSlash = /%2[Ff]%2[Ff]/
    if (doubleEncodedSlash.test(url)) {
      console.warn('[Security] Invalid redirect: encoded double slash', url)
      return null
    }

    // 6. Block sensitive routes
    const blockedRoutes = ['/login', '/logout', '/']
    if (blockedRoutes.includes(decoded)) {
      console.warn('[Security] Invalid redirect: blocked route', decoded)
      return null
    }

    // 7. Validate against allowed route patterns (whitelist approach)
    const allowedPatterns = [
      // Core pages
      /^\/dashboard$/,
      /^\/profile$/,
      /^\/clusters$/,
      /^\/integrations$/,
      /^\/logging$/,
      /^\/audit-settings$/,
      
      // User management
      /^\/users$/,
      /^\/groups$/,
      
      // Cluster-specific routes
      // Pattern: /clusters/{cluster}
      /^\/clusters\/[a-zA-Z0-9_-]+$/,
      // Pattern: /clusters/{cluster}/{resource}
      /^\/clusters\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/,
      // Pattern: /clusters/{cluster}/namespaces/{namespace}/{resource}
      /^\/clusters\/[a-zA-Z0-9_-]+\/namespaces\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/,
      // Pattern: /clusters/{cluster}/namespaces/{namespace}/{resource}/{resourceName} (DETAIL PAGES)
      /^\/clusters\/[a-zA-Z0-9_-]+\/namespaces\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/,
      // Pattern: /clusters/{cluster}/nodes/{nodeName} (NODE DETAIL)
      /^\/clusters\/[a-zA-Z0-9_-]+\/nodes\/[a-zA-Z0-9_.-]+$/,
      // Pattern: /clusters/{cluster}/{resource} (cluster-scoped resources)
      /^\/clusters\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/,
      
      // Resource routes (workloads, networking, storage, config, security)
      /^\/pods$/,
      /^\/deployments$/,
      /^\/daemonsets$/,
      /^\/statefulsets$/,
      /^\/replicasets$/,
      /^\/jobs$/,
      /^\/cronjobs$/,
      /^\/services$/,
      /^\/endpoints$/,
      /^\/ingresses$/,
      /^\/ingressclasses$/,
      /^\/networkpolicies$/,
      /^\/storageclasses$/,
      /^\/persistentvolumes$/,
      /^\/persistentvolumeclaims$/,
      /^\/configmaps$/,
      /^\/secrets$/,
      /^\/serviceaccounts$/,
      /^\/roles$/,
      /^\/rolebindings$/,
      /^\/clusterroles$/,
      /^\/clusterrolebindings$/,
      /^\/nodes$/,
      /^\/namespaces$/,
      /^\/events$/,
      /^\/hpas$/,
      /^\/pdbs$/,
      /^\/leases$/,
      /^\/priorityclasses$/,
      /^\/runtimeclasses$/,
      /^\/mutatingwebhookconfigurations$/,
      /^\/validatingwebhookconfigurations$/,
      /^\/customresourcedefinitions$/,
      
      // Custom Resources (CRDs)
      // Pattern: /customresources/{group}/{version}/{resource}
      /^\/customresources\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_-]+$/,
      // Pattern: /clusters/{cluster}/customresources/{group}/{version}/{resource}
      /^\/clusters\/[a-zA-Z0-9_-]+\/customresources\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_-]+$/,
      // Pattern: /clusters/{cluster}/namespaces/{namespace}/customresources/{group}/{version}/{resource}
      /^\/clusters\/[a-zA-Z0-9_-]+\/namespaces\/[a-zA-Z0-9_-]+\/customresources\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_-]+$/,
      // Pattern: /clusters/{cluster}/namespaces/{namespace}/customresources/{group}/{version}/{resource}/{resourceName}
      /^\/clusters\/[a-zA-Z0-9_-]+\/namespaces\/[a-zA-Z0-9_-]+\/customresources\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/,
    ]

    const isAllowed = allowedPatterns.some((pattern) => pattern.test(decoded))
    if (!isAllowed) {
      console.warn('[Security] Invalid redirect: not in whitelist', decoded)
      return null
    }

    console.log('[Security] Validated redirect URL:', decoded)
    return decoded
  } catch (error) {
    console.error('[Security] Error validating redirect:', error)
    return null
  }
}

/**
 * Get safe redirect URL from query parameters with fallback to dashboard
 * 
 * @param searchParams - URLSearchParams object from useSearchParams()
 * @returns Safe redirect URL (validated or default)
 */
export const getSafeRedirectUrl = (searchParams: URLSearchParams): string => {
  const redirect = searchParams.get('redirect')
  const validated = validateRedirectUrl(redirect)

  if (validated) {
    console.log('[Navigation] Using redirect:', validated)
    return validated
  }

  console.log('[Navigation] Using default: /dashboard')
  return '/dashboard'
}

/**
 * Create a redirect URL with encoded path parameter
 * 
 * @param basePath - Base path (/login or /)
 * @param redirectTo - Path to redirect to after authentication
 * @returns URL with redirect query parameter
 */
export const createRedirectUrl = (basePath: string, redirectTo: string): string => {
  // Validate the redirect path before encoding
  const validated = validateRedirectUrl(redirectTo)
  
  // If validation fails or it's the default route, return base path without redirect
  if (!validated || validated === '/dashboard') {
    return basePath
  }

  // Encode the validated redirect path
  const encoded = encodeURIComponent(validated)
  return `${basePath}?redirect=${encoded}`
}

/**
 * Extract full path including pathname, search, and hash
 * 
 * @param location - React Router location object
 * @returns Full path string
 */
export const getFullPath = (location: { pathname: string; search: string; hash: string }): string => {
  return location.pathname + location.search + location.hash
}

/**
 * Check if the current path should preserve redirect intent
 * Some paths like public pages shouldn't be saved as intended destinations
 * 
 * @param path - Path to check
 * @returns True if path should be preserved
 */
export const shouldPreserveIntent = (path: string): boolean => {
  const nonPreservedPaths = ['/', '/login', '/logout']
  return !nonPreservedPaths.includes(path)
}

