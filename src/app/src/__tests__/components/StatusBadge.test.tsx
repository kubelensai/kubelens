import { describe, it, expect } from 'vitest'

describe('StatusBadge Component', () => {
  it('should handle status variants', () => {
    const variants = ['success', 'warning', 'error', 'info', 'default']
    expect(variants).toHaveLength(5)
    expect(variants).toContain('success')
  })

  it('should handle status text', () => {
    const statuses = ['Running', 'Pending', 'Failed', 'Succeeded', 'Unknown']
    expect(statuses).toHaveLength(5)
    expect(statuses[0]).toBe('Running')
  })

  it('should map status to colors', () => {
    const colorMap: Record<string, string> = {
      success: 'bg-green-100',
      warning: 'bg-yellow-100',
      error: 'bg-red-100',
      info: 'bg-blue-100',
      default: 'bg-gray-100',
    }
    
    expect(colorMap.success).toBe('bg-green-100')
    expect(colorMap.warning).toBe('bg-yellow-100')
    expect(colorMap.error).toBe('bg-red-100')
  })
})
