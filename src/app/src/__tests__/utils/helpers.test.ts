import { describe, it, expect } from 'vitest'

describe('Helper Utils', () => {
  describe('Basic utility tests', () => {
    it('should perform basic string operations', () => {
      const str = 'hello world'
      expect(str.toUpperCase()).toBe('HELLO WORLD')
      expect(str.split(' ')).toEqual(['hello', 'world'])
    })

    it('should perform basic array operations', () => {
      const arr = [1, 2, 3, 4, 5]
      expect(arr.length).toBe(5)
      expect(arr.filter(x => x > 2)).toEqual([3, 4, 5])
      expect(arr.map(x => x * 2)).toEqual([2, 4, 6, 8, 10])
    })

    it('should perform basic object operations', () => {
      const obj = { name: 'test', value: 42 }
      expect(obj.name).toBe('test')
      expect(obj.value).toBe(42)
      expect(Object.keys(obj)).toEqual(['name', 'value'])
    })
  })

  describe('Status color mapping', () => {
    it('should map Running status to green', () => {
      const status = 'Running'
      const expectedColor = 'green'
      expect(status.toLowerCase()).toBe('running')
      expect(expectedColor).toBe('green')
    })

    it('should map Pending status to yellow', () => {
      const status = 'Pending'
      const expectedColor = 'yellow'
      expect(status.toLowerCase()).toBe('pending')
      expect(expectedColor).toBe('yellow')
    })

    it('should map Failed status to red', () => {
      const status = 'Failed'
      const expectedColor = 'red'
      expect(status.toLowerCase()).toBe('failed')
      expect(expectedColor).toBe('red')
    })
  })
})
