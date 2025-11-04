import { describe, it, expect } from 'vitest'
import { formatAge, formatBytes, formatCPU } from '@/utils/format'

describe('Format Utils', () => {
  describe('formatAge', () => {
    it('should format age in seconds', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 30 * 1000)
      expect(formatAge(past.toISOString())).toBe('30s')
    })

    it('should format age in minutes', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 5 * 60 * 1000)
      expect(formatAge(past.toISOString())).toBe('5m')
    })

    it('should format age in hours', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      expect(formatAge(past.toISOString())).toBe('3h')
    })

    it('should format age in days', () => {
      const now = new Date()
      const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      expect(formatAge(past.toISOString())).toBe('2d')
    })

    it('should handle invalid dates', () => {
      // Invalid dates return 0s
      expect(formatAge('')).toBe('0s')
      expect(formatAge('invalid')).toBe('0s')
    })

    it('should handle future dates', () => {
      const now = new Date()
      const future = new Date(now.getTime() + 1000)
      expect(formatAge(future.toISOString())).toBe('0s')
    })
  })

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(0)).toBe('0 B')
      expect(formatBytes(100)).toBe('100.00 B')
      expect(formatBytes(1024)).toBe('1.00 KB')
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB')
    })

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.50 KB')
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB')
    })
  })

  describe('formatCPU', () => {
    it('should format millicores to cores', () => {
      expect(formatCPU(100)).toBe('0.100 cores')
      expect(formatCPU(500)).toBe('0.500 cores')
      expect(formatCPU(1000)).toBe('1.000 cores')
      expect(formatCPU(2000)).toBe('2.000 cores')
    })

    it('should handle zero', () => {
      expect(formatCPU(0)).toBe('0.000 cores')
    })

    it('should handle decimal millicores', () => {
      expect(formatCPU(250)).toBe('0.250 cores')
    })
  })
})
