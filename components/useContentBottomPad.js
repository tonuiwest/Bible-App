import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The persistent banner (+ its own top border/padding) is roughly 60-70pt.
// Adding the device's safe-area bottom inset on top of that keeps scrollable
// content from ever being hidden behind the banner or a home-indicator area.
const BANNER_ALLOWANCE = 64;

export function useContentBottomPad(extra = 0) {
  const insets = useSafeAreaInsets();
  return insets.bottom + BANNER_ALLOWANCE + extra;
}
