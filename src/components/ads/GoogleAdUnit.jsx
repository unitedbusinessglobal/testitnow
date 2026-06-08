// ============================================================
// AdSense Component
// Deployable as part of any service that needs ad display
// ============================================================

import { useEffect, useRef } from 'react';
import { ADSENSE_CONFIG } from '../../config/services';

/**
 * GoogleAdUnit — renders a single AdSense ad slot.
 *
 * Usage:
 *   <GoogleAdUnit slot="headerBanner" format="horizontal" />
 *   <GoogleAdUnit slot="sidebarTop"   format="rectangle" className="my-4" />
 *
 * Formats: 'horizontal' | 'rectangle' | 'vertical' | 'auto'
 */
export function GoogleAdUnit({ slot, format = 'auto', className = '', style = {} }) {
  const adRef = useRef(null);
  const slotId = ADSENSE_CONFIG.slots[slot];

  useEffect(() => {
    if (!ADSENSE_CONFIG.enabled || !slotId) return;

    try {
      // Push the ad after the component mounts
      if (window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.warn('[AdSense] Push failed:', e);
    }
  }, [slotId]);

  // In development, show a labeled placeholder
  if (!ADSENSE_CONFIG.enabled) {
    return <AdPlaceholder format={format} label={slot} className={className} />;
  }

  if (!slotId) {
    console.warn(`[AdSense] No slot ID configured for key: "${slot}"`);
    return null;
  }

  const formatStyles = {
    horizontal: { display: 'block', width: '100%', height: '90px' },
    rectangle:  { display: 'block', width: '300px', height: '250px' },
    vertical:   { display: 'block', width: '160px', height: '600px' },
    auto:       { display: 'block' },
  };

  return (
    <div className={`ad-unit ad-unit--${format} ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={{ ...formatStyles[format], ...style }}
        data-ad-client={ADSENSE_CONFIG.publisherId}
        data-ad-slot={slotId}
        data-ad-format={format === 'auto' ? 'auto' : undefined}
        data-full-width-responsive={format === 'auto' ? 'true' : undefined}
      />
    </div>
  );
}

/**
 * AdPlaceholder — dev-mode stand-in for a real ad unit.
 */
function AdPlaceholder({ format, label, className }) {
  const sizes = {
    horizontal: 'w-full h-20',
    rectangle:  'w-72 h-60',
    vertical:   'w-40 h-[600px]',
    auto:       'w-full h-24',
  };

  return (
    <div
      className={`
        ${sizes[format] || sizes.auto}
        ${className}
        border-2 border-dashed border-amber-300
        bg-amber-50 rounded-lg
        flex flex-col items-center justify-center
        text-amber-600 text-xs font-mono
        select-none
      `}
    >
      <span className="font-bold text-sm mb-1">📢 AD UNIT</span>
      <span className="opacity-70">{label} · {format}</span>
      <span className="opacity-50 mt-1">Google AdSense (dev placeholder)</span>
    </div>
  );
}

/**
 * AdSenseScript — inject the AdSense library once into <head>.
 * Call this in your root App or index.html.
 *
 * In index.html you can alternatively add:
 *   <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXX" crossorigin="anonymous"></script>
 */
export function AdSenseScript() {
  useEffect(() => {
    if (!ADSENSE_CONFIG.enabled) return;
    if (document.querySelector('script[data-adsense]')) return; // already loaded

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CONFIG.publisherId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-adsense', 'true');
    document.head.appendChild(script);
  }, []);

  return null;
}
