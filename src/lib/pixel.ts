import { metaPixelId } from '../config';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  version?: string;
};

type PixelWindow = Window & { fbq?: Fbq };

let pixelInitialized = false;

export function trackPageView(): void {
  if (!metaPixelId) return;
  const pixelWindow = window as PixelWindow;
  if (!pixelInitialized) {
    const fbq: Fbq = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    };
    fbq.queue = [] as unknown[][];
    fbq.version = '2.0';
    pixelWindow.fbq = fbq;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
    pixelWindow.fbq?.('init', metaPixelId);
    pixelInitialized = true;
  }
  pixelWindow.fbq?.('track', 'PageView');
}

export function trackViewContent(): void {
  if (metaPixelId) (window as PixelWindow).fbq?.('track', 'ViewContent', { currency: 'BDT', value: 249 });
}

export function trackInitiateCheckout(): void {
  if (metaPixelId) (window as PixelWindow).fbq?.('track', 'InitiateCheckout', { currency: 'BDT', value: 249 });
}

export function trackVerifiedPurchase(orderId: string): void {
  if (metaPixelId) {
    (window as PixelWindow).fbq?.('track', 'Purchase', { currency: 'BDT', value: 249 }, { eventID: orderId });
  }
}
