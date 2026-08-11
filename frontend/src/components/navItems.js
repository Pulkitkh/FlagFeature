import { Clock, Flag, Layers, Sparkles, UserCog, Users } from 'lucide-react'

/**
 * One list, rendered twice: as the desktop rail and as the mobile drawer.
 * Keeping it here is what stops a route from existing in one and not the
 * other — which is exactly how the console ended up unreachable on phones.
 */
export const NAV_ITEMS = [
  { to: '/flags', labelKey: 'navFlags', icon: Flag },
  { to: '/environments', labelKey: 'navEnvironments', icon: Layers },
  { to: '/groups', labelKey: 'navGroups', icon: Users },
  { to: '/audit-log', labelKey: 'navAudit', icon: Clock },
  { to: '/cleanup', labelKey: 'navCleanup', icon: Sparkles },
]

/** Managing accounts is admin-only, so a viewer isn't shown a door they can't
 *  open. The route guards it too. */
export function navItemsFor(isAdmin) {
  return isAdmin
    ? [...NAV_ITEMS, { to: '/accounts', labelKey: 'navAccounts', icon: UserCog }]
    : NAV_ITEMS
}
