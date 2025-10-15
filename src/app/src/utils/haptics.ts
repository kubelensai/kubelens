/**
 * Simple Haptics Utility
 * Provides vibration feedback for mobile apps
 */

import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { isCapacitor } from '@/config/env'

/**
 * Light tap feedback - for menu items, navigation
 */
export const lightTap = async () => {
  if (!isCapacitor()) return
  
  try {
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch (error) {
    // Silently fail on unsupported devices
  }
}

/**
 * Medium tap feedback - for buttons, selections
 */
export const mediumTap = async () => {
  if (!isCapacitor()) return
  
  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch (error) {
    // Silently fail
  }
}

