// ============================================================
// GoogleAdUnit.jsx
// Publisher ID: ca-pub-7683488535147970
// Slot IDs are set via Netlify env vars (REACT_APP_AD_SLOT_*)
// Once AdSense approves your site, create ad units in the
// AdSense dashboard and paste the slot IDs into Netlify.
// ============================================================

import React, { useEffect, useRef } from 'react';
import { ADSENSE_CONFIG } from '../../config/services';

/**
 * GoogleAdUnit — renders a single AdSense ad slot.
 * Shows a yellow placeholder in development.
 *
 * Usage:
 *   <GoogleAdUnit slot="headerBanner"  format="horizontal" />
 *   <GoogleAdUnit slot="sidebarTop"    format="rectangle"  />
 *   <GoogleAdUnit slot="inFeed"        format="auto"       />
 */
export function GoogleAdUnit({ slot, format = 'auto', className = '', style = {} }) {
  const adRef  = useRef(null);
  const slotId = ADSENSE_CONFIG.slots[slot];

  useEffect(() => {
    if (!ADSENSE_CONFIG.enabled) return;
    if (!slotId) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn('[AdSense] push failed:', e);
    }
  }, [slotId]);

  // ── Development placeholder ───────────────────────────────
  if (!ADSENSE_CONFIG.enabled) {
    return <AdPlaceholder format={format} slot={slot} className={className} />;
  }

  // ── No slot ID configured yet — render nothing ────────────
  if (!slotId) return null;

  const sizeStyles = {
    horizontal: { display: 'block', width: '100%',  minHeight: '90px'  },
    rectangle:  { display: 'block', width: '300px', minHeight: '250px' },
    vertical:   { display: 'block', width: '160px', minHeight: '600px' },
    auto:       { display: 'block' },
  };

  return (
    <div ref={adRef} className={`overflow-hidden ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ ...sizeStyles[format] || sizeStyles.auto, ...style }}
        data-ad-client="ca-pub-7683488535147970"
        data-ad-slot={slotId}
        data-ad-format={format === 'auto' ? 'auto' : undefined}
        data-full-width-responsive={format === 'auto' ? 'true' : undefined}
      />
    </div>
  );
}

// ── Dev placeholder ───────────────────────────────────────────
function AdPlaceholder({ format, slot, className }) {
  const sizes = {
    horizontal: 'w-full h-[90px]',
    rectangle:  'w-[300px] h-[250px]',
    vertical:   'w-[160px] h-[600px]',
    auto:       'w-full h-[90px]',
  };

  return (
    <div className={`
      ${sizes[format] || sizes.auto} ${className}
      border-2 border-dashed border-amber-400/50 bg-amber-950/20
      rounded-lg flex flex-col items-center justify-center gap-1
      text-amber-500/70 select-none
    `}>
      <span className="text-xs font-bold">📢 AdSense</span>
      <span className="text-xs opacity-60">{slot} · {format}</span>
      <span className="text-xs opacity-40">ca-pub-7683488535147970</span>
    </div>
  );
}

/**
 * AdSenseScript — not needed since the script is in index.html.
 * Kept for API compatibility — renders nothing.
 */
export function AdSenseScript() {
  return null;
}
