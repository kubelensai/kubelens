import { useEffect, useRef, useState } from 'react';
import { ExclamationTriangleIcon, CubeIcon } from '@heroicons/react/24/outline';

interface UIMetadata {
  assets_url: string;
  root_id: string;
}

interface ExtensionUILoaderProps {
  extensionName: string;
  ui: UIMetadata;
  config?: Record<string, string>;
}

/**
 * ExtensionUILoader - Micro-frontend loader for extension UIs
 * 
 * This component dynamically loads and mounts extension UI assets.
 * Extensions can provide:
 * - A JavaScript bundle that exports a mount/unmount function
 * - CSS styles that are scoped to the extension container
 * 
 * Security considerations:
 * - Extensions are loaded in an isolated container with scoped styles
 * - CSP should restrict external script sources
 * - Extensions run in the same origin but with controlled API access
 */
export default function ExtensionUILoader({ extensionName, ui, config }: ExtensionUILoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!ui.assets_url || !containerRef.current) {
      setLoading(false);
      return;
    }

    const loadExtensionUI = async () => {
      setLoading(true);
      setError(null);

      try {
        // The assets URL should point to a directory containing:
        // - index.js (main bundle with mount/unmount exports)
        // - index.css (optional styles)
        const baseUrl = ui.assets_url.endsWith('/') ? ui.assets_url : `${ui.assets_url}/`;
        
        // Load CSS if exists
        const cssUrl = `${baseUrl}index.css`;
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = cssUrl;
        cssLink.id = `extension-css-${extensionName}`;
        
        // Only add if not already loaded
        if (!document.getElementById(cssLink.id)) {
          cssLink.onerror = () => {
            // CSS is optional, don't error
            console.log(`[ExtensionUI] No CSS found for ${extensionName}`);
          };
          document.head.appendChild(cssLink);
        }

        // Load JavaScript bundle
        const jsUrl = `${baseUrl}index.js`;
        
        // Check if already loaded
        const existingScript = document.querySelector(`script[data-extension="${extensionName}"]`);
        if (existingScript) {
          // Already loaded, just mount
          mountExtension();
          return;
        }

        const script = document.createElement('script');
        script.src = jsUrl;
        script.async = true;
        script.dataset.extension = extensionName;
        
        script.onload = () => {
          mountExtension();
        };

        script.onerror = () => {
          setError(`Failed to load extension UI from ${jsUrl}`);
          setLoading(false);
        };

        document.body.appendChild(script);
      } catch (err) {
        console.error(`[ExtensionUI] Error loading ${extensionName}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load extension UI');
        setLoading(false);
      }
    };

    const mountExtension = () => {
      try {
        // Extension should register itself on window.kubelensExtensions
        const extensionModule = (window as any).kubelensExtensions?.[extensionName];
        
        if (extensionModule?.mount && containerRef.current) {
          extensionModule.mount(containerRef.current, {
            config,
            // Provide limited API access to extensions
            api: {
              // Extensions can call back to the main app
              notify: (message: string, type: 'info' | 'success' | 'error' = 'info') => {
                console.log(`[Extension ${extensionName}] ${type}: ${message}`);
                // Could integrate with a toast notification system
              },
              getConfig: () => config,
            },
          });
          setMounted(true);
        } else {
          // No mount function - extension might render directly to the container
          console.log(`[ExtensionUI] ${extensionName} has no mount function, assuming self-rendering`);
        }
        setLoading(false);
      } catch (err) {
        console.error(`[ExtensionUI] Error mounting ${extensionName}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to mount extension UI');
        setLoading(false);
      }
    };

    loadExtensionUI();

    // Cleanup on unmount
    return () => {
      try {
        const extensionModule = (window as any).kubelensExtensions?.[extensionName];
        if (extensionModule?.unmount && mounted) {
          extensionModule.unmount();
        }
      } catch (err) {
        console.error(`[ExtensionUI] Error unmounting ${extensionName}:`, err);
      }
    };
  }, [extensionName, ui.assets_url, config, mounted]);

  if (!ui.assets_url) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <CubeIcon className="h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This extension does not have a UI component.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading extension UI...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <ExclamationTriangleIcon className="h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
          Failed to load extension UI
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      id={ui.root_id}
      className="extension-ui-container"
      data-extension={extensionName}
      style={{
        // Provide some isolation for extension styles
        contain: 'layout style',
      }}
    >
      {/* Extension UI will be mounted here */}
    </div>
  );
}

/**
 * Type declaration for extensions to use
 * 
 * Extensions should register themselves like:
 * 
 * window.kubelensExtensions = window.kubelensExtensions || {};
 * window.kubelensExtensions['my-extension'] = {
 *   mount: (container, context) => {
 *     // Render UI into container
 *     container.innerHTML = '<div>My Extension UI</div>';
 *   },
 *   unmount: () => {
 *     // Cleanup
 *   }
 * };
 */
declare global {
  interface Window {
    kubelensExtensions?: {
      [key: string]: {
        mount: (container: HTMLElement, context: {
          config?: Record<string, string>;
          api: {
            notify: (message: string, type?: 'info' | 'success' | 'error') => void;
            getConfig: () => Record<string, string> | undefined;
          };
        }) => void;
        unmount?: () => void;
      };
    };
  }
}
