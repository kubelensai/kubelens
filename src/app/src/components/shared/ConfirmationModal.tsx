import { useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'warning' | 'danger' | 'info'
  isLoading?: boolean
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false
}: ConfirmationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Handle ESC key and body scroll
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, isLoading])

  if (!isOpen) return null

  const iconColors = {
    warning: 'bg-yellow-100 dark:bg-yellow-900/20',
    danger: 'bg-red-100 dark:bg-red-900/20',
    info: 'bg-blue-100 dark:bg-blue-900/20'
  }

  const iconTextColors = {
    warning: 'text-yellow-600 dark:text-yellow-400',
    danger: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400'
  }

  const buttonColors = {
    warning: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500 dark:bg-yellow-500 dark:hover:bg-yellow-600',
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600',
    info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600'
  }

  const modalContent = (
    <>
      {/* Backdrop - Full screen with blur */}
      <div
        className="fixed inset-0 bg-black/30 dark:bg-black/50"
        style={{ 
          zIndex: 9998,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Container */}
      <div
        className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4"
        style={{ zIndex: 9999 }}
      >
        {/* Modal Content */}
        <div
          ref={modalRef}
          className="relative w-full max-w-md rounded-3xl bg-white dark:bg-gray-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            disabled={isLoading}
            className="absolute right-3 top-3 flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:right-6 sm:top-6 sm:h-11 sm:w-11 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>

          {/* Content */}
          <div className="flex flex-col px-6 py-8 sm:px-10 sm:py-12">
            {/* Icon */}
            <div className="flex items-center justify-center mb-6">
              <div className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full ${iconColors[type]}`}>
                <ExclamationTriangleIcon className={`h-7 w-7 sm:h-8 sm:w-8 ${iconTextColors[type]}`} />
              </div>
            </div>

            {/* Title */}
            <h3 className="mb-3 text-center text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white/90">
              {title}
            </h3>

            {/* Message */}
            <p className="mb-8 text-center text-sm sm:text-base text-gray-500 dark:text-gray-400 whitespace-pre-line break-words">
              {message}
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 h-11 sm:h-12 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-3 focus:ring-gray-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 h-11 sm:h-12 rounded-lg px-4 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-3 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonColors[type]}`}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return createPortal(modalContent, document.body)
}
