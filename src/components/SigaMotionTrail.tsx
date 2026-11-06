/** Decorative, non-interactive traces; animation and accessibility live in CSS. */
export function SigaMotionTrail() {
  return (
    <svg className="siga-motion-trail" viewBox="0 0 280 180" fill="none" aria-hidden="true" focusable="false">
      <path className="siga-motion-track" d="M0 42H68L105 79H192L234 37H280" />
      <path className="siga-motion-track" d="M0 132H96L130 98H213L255 140H280" />
      <path className="siga-motion-signal" pathLength="100" d="M0 42H68L105 79H192L234 37H280" />
      <path className="siga-motion-signal siga-motion-signal-secondary" pathLength="100" d="M0 132H96L130 98H213L255 140H280" />
    </svg>
  );
}