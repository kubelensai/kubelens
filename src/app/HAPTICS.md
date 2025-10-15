# Haptics Support - Sidebar Navigation

Kubelens mobile app now includes **haptic feedback** for sidebar navigation to enhance user experience.

## What's Implemented

### ✅ Sidebar Navigation Haptics

Light vibration feedback when:
- **Clicking menu items** - provides tactile confirmation of navigation
- **Expanding/collapsing groups** - feels responsive and interactive

### How it Works

```typescript
import { lightTap } from '@/utils/haptics'

// On menu item click
<Link onClick={() => lightTap()}>
  Dashboard
</Link>

// On group expand/collapse
const toggleGroup = async (groupName: string) => {
  await lightTap()
  // ... toggle logic
}
```

## Platform Support

- ✅ **iOS**: Haptic feedback via Taptic Engine
- ✅ **Android**: Vibration feedback
- ✅ **Web**: Safely ignored (no errors)

## Testing

### On Mobile Device:

1. Build the mobile app:
```bash
npm run build:mobile
npm run mobile:android  # or mobile:ios
```

2. Navigate through the sidebar menu
3. You should feel light vibrations when:
   - Clicking on menu items (Pods, Services, etc.)
   - Expanding/collapsing groups (Workloads, Network, etc.)

### On Web:

The haptics will safely no-op (do nothing) without causing any errors.

## API Reference

### `lightTap()`

Provides light haptic feedback for subtle interactions.

**Usage:**
```typescript
import { lightTap } from '@/utils/haptics'

await lightTap()
```

**When to use:**
- Menu item clicks
- Navigation changes
- Small UI interactions

### `mediumTap()`

Provides medium haptic feedback for normal interactions (not yet used in sidebar).

**Usage:**
```typescript
import { mediumTap } from '@/utils/haptics'

await mediumTap()
```

**When to use:**
- Button clicks
- Form submissions
- Confirmations

## Future Enhancements

Potential areas to add haptics:
- [ ] Success/error notifications
- [ ] Delete confirmations
- [ ] Pull to refresh
- [ ] Form validation
- [ ] Modal open/close

## Disabling Haptics

Currently haptics are always enabled on mobile. In the future, we can add a settings toggle:

```typescript
// In settings store
const { hapticsEnabled, setHapticsEnabled } = useSettingsStore()

// In haptics utility
export const lightTap = async () => {
  if (!isCapacitor() || !hapticsEnabled) return
  // ... haptic code
}
```

## Resources

- [Capacitor Haptics API](https://capacitorjs.com/docs/apis/haptics)
- [iOS HIG - Haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)

