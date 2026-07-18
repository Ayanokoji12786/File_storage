import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/user'
import type { AuthUser } from '@/types'

export function SidebarProfile({ user }: { user: AuthUser }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent p-3">
      <Avatar className="size-9">
        {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name ?? user.email} />}
        <AvatarFallback className="bg-primary/15 text-primary">
          {getInitials(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{user.name ?? 'Account'}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}
