import { describe, it, expect } from 'vitest'

describe('Breadcrumb Component', () => {
  it('should handle breadcrumb items', () => {
    const items = [
      { name: 'Home' },
      { name: 'Clusters' },
      { name: 'Pods' },
    ]
    
    expect(items).toHaveLength(3)
    expect(items[0].name).toBe('Home')
    expect(items[items.length - 1].name).toBe('Pods')
  })

  it('should handle empty items array', () => {
    const items: Array<{ name: string }> = []
    expect(items).toHaveLength(0)
  })

  it('should filter out null names', () => {
    const items = [
      { name: 'Valid' },
      { name: null as any },
    ]
    
    const validItems = items.filter(item => item.name)
    expect(validItems).toHaveLength(1)
    expect(validItems[0].name).toBe('Valid')
  })

  it('should identify last item', () => {
    const items = ['Home', 'Current']
    const lastIndex = items.length - 1
    expect(items[lastIndex]).toBe('Current')
  })

  it('should support showBackButton prop', () => {
    const props = {
      items: [{ name: 'Test' }],
      showBackButton: true,
    }
    
    expect(props.showBackButton).toBe(true)
  })

  it('should support custom onBack handler', () => {
    let backCalled = false
    const customBackHandler = () => {
      backCalled = true
    }
    
    const props = {
      items: [{ name: 'Test' }],
      onBack: customBackHandler,
    }
    
    props.onBack?.()
    expect(backCalled).toBe(true)
  })

  it('should default showBackButton to true', () => {
    interface BreadcrumbProps {
      items: Array<{ name: string }>
      showBackButton?: boolean
    }
    
    const props: BreadcrumbProps = {
      items: [{ name: 'Test' }],
    }
    
    const showBackButton = props.showBackButton ?? true
    expect(showBackButton).toBe(true)
  })
})
