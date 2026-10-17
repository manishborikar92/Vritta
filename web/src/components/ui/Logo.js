'use client';

/**
 * Authoritative Vritta Logo component — The Guiding Sutra.
 * A continuous monoline ribbon loop representing the unbroken thread connecting all daily practices,
 * centered around a calm anchor point of balance.
 *
 * Source of truth: docs/branding-exploration/03-logo-concepts/logo-concept-3-guiding-sutra.svg
 * Authoritative Brand Swatches:
 * - Deep Obsidian: #090D16
 * - Luminous Teal: #14B8A6 (Dark-mode ribbon loop)
 * - Warm Amber: #D97706 (Center balance dot)
 * - Accessible Deep Teal: #0F766E (Light-mode ribbon loop variant for WCAG AA >= 5.2:1)
 */
export default function Logo({ className = "w-8 h-8", title = "Vritta Logo: The Guiding Sutra" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="20 20 160 160"
      fill="none"
      className={className}
      aria-label={title}
      role="img"
    >
      {/* Continuous Harmonious Thread Loop (Bezier Precision) */}
      <path
        d="M 68 132 C 44 132 40 100 68 84 C 92 70 108 130 132 116 C 160 100 156 68 132 68 C 108 68 92 128 68 132 Z"
        className="stroke-accent transition-colors"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center Balance Point */}
      <circle
        cx="100"
        cy="100"
        r="8"
        className="fill-brand-amber transition-colors"
      />
    </svg>
  );
}
