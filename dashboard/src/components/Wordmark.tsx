import { cn } from '../utils';

/**
 * urdr mark: two strands weaving, the lower one broken where it passes behind the upper.
 * That break is what separates a weave from two lines merely crossing — Urðr sits at the
 * world tree spinning what becomes of things.
 *
 * Below ~20px the 1.8px gap renders as less than a pixel and the break just reads as a
 * smudge, so small sizes draw the strand unbroken instead. currentColor throughout, so the
 * mark follows the theme rather than needing the light/dark PNG pair it replaces — index.css
 * states the brand is monochrome by default, with the saturated glow reserved for the
 * streaming pulse.
 */
export function UrdrMark({ className, size = 22 }: { className?: string; size?: number }) {
  const woven = size >= 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M2.5 6.5C6 6.5 6 17.5 12 17.5s6-11 9.5-11" />
        {woven ? (
          <>
            <path d="M2.5 17.5C5 17.5 5.6 12.6 6.9 9.6" />
            <path d="M9.3 7.2C10.2 6.7 11 6.5 12 6.5c6 0 6 11 9.5 11" />
          </>
        ) : (
          <path d="M2.5 17.5C6 17.5 6 6.5 12 6.5s6 11 9.5 11" />
        )}
      </g>
    </svg>
  );
}

/** Mark plus wordmark, sized to sit on the header's 22px baseline. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2 text-fg', className)}>
      <UrdrMark size={22} className="shrink-0" />
      <span className="text-[19px] font-semibold leading-none tracking-[-0.02em]">urdr</span>
    </span>
  );
}
