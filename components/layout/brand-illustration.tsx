/**
 * Flat, self-contained illustration for the auth brand panel — a folder with
 * documents and a magnifier, echoing the reference without any external asset.
 */
export function BrandIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* back sheet */}
      <g transform="rotate(-9 150 140)">
        <rect x="96" y="52" width="132" height="168" rx="16" fill="white" fillOpacity="0.9" />
        <rect x="120" y="86" width="84" height="12" rx="6" fill="#E2E8F0" />
        <rect x="120" y="112" width="60" height="10" rx="5" fill="#EDF2F7" />
        <rect x="120" y="132" width="72" height="10" rx="5" fill="#EDF2F7" />
        <circle cx="150" cy="180" r="18" fill="#38BDF8" fillOpacity="0.5" />
      </g>

      {/* front folder */}
      <path
        d="M150 150c0-8 6-14 14-14h44l16 16h74c8 0 14 6 14 14v70c0 8-6 14-14 14H164c-8 0-14-6-14-14v-86z"
        fill="white"
      />
      <path
        d="M150 168h162v82c0 8-6 14-14 14H164c-8 0-14-6-14-14v-82z"
        fill="white"
        fillOpacity="0.85"
      />
      <rect x="176" y="196" width="60" height="10" rx="5" fill="#FBD5D5" />
      <rect x="176" y="216" width="90" height="10" rx="5" fill="#FDE8E8" />

      {/* magnifier */}
      <circle cx="266" cy="210" r="34" stroke="#A5B4FC" strokeWidth="10" fill="white" fillOpacity="0.25" />
      <rect x="292" y="236" width="34" height="12" rx="6" transform="rotate(45 292 236)" fill="#FBBF24" />
    </svg>
  )
}
