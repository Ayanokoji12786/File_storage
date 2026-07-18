/** Two-letter initials from a name (preferred) or email, for avatar fallbacks. */
export function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}
