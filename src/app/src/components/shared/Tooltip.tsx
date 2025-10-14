import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: string
  children: React.ReactNode
  className?: string
  mode?: 'hover' | 'click' // hover: tự động ẩn khi rê chuột ra, click: ẩn khi click outside
}

export default function Tooltip({ content, children, className = '', mode = 'hover' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      
      // Calculate position (bottom center by default)
      let top = triggerRect.bottom + 8
      let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
      
      // Adjust if tooltip goes off screen
      if (left < 10) left = 10
      if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10
      }
      if (top + tooltipRect.height > window.innerHeight - 10) {
        // Show above if not enough space below
        top = triggerRect.top - tooltipRect.height - 8
      }
      
      setPosition({ top, left })
    }
  }, [isVisible])

  // Click outside to close (only for click mode)
  useEffect(() => {
    if (mode === 'click' && isVisible) {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          triggerRef.current && 
          tooltipRef.current &&
          !triggerRef.current.contains(event.target as Node) &&
          !tooltipRef.current.contains(event.target as Node)
        ) {
          setIsVisible(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [mode, isVisible])

  const handleTrigger = () => {
    if (mode === 'click') {
      setIsVisible(!isVisible)
    }
  }

  const handleMouseEnter = () => {
    if (mode === 'hover') {
      setIsVisible(true)
    }
  }

  const handleMouseLeave = () => {
    if (mode === 'hover') {
      setIsVisible(false)
    }
  }

  const tooltipContent = isVisible && (
    <div
      ref={tooltipRef}
      className={`fixed z-[9999] px-3 py-2 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg max-w-sm whitespace-pre-wrap break-words ${className}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: mode === 'click' ? 'auto' : 'none'
      }}
    >
      {content}
      {/* Arrow */}
      <div
        className="absolute w-2 h-2 bg-gray-900 dark:bg-gray-700 transform rotate-45"
        style={{
          top: '-4px',
          left: '50%',
          marginLeft: '-4px'
        }}
      />
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleTrigger}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>
      {tooltipContent && createPortal(tooltipContent, document.body)}
    </>
  )
}

