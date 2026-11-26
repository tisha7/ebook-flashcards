export const PRODUCT_PRICE = 249;
export const PRODUCT_NAME = 'শিশুর মুখে ফুটুক বুলি';
export const BUNDLE_NAME = 'ইবুক + ৫০টি প্রিন্টেবল ফ্ল্যাশকার্ড';
export const FACEBOOK_URL =
  'https://www.facebook.com/p/Sohoj-Parenting-61590813201845/';

// Set a confirmed ISO 8601 deadline with a timezone (e.g. 2026-12-31T23:59:59+06:00); null keeps the offer evergreen.
export const OFFER_EXPIRY_ISO: string | null = null;

export const paymentConfig = {
  receiverNumber: '01860270024',
  accountType: 'অ্যাকাউন্টের ধরন যাচাই করে নিন',
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  missingVariables: [
    ...(!supabaseUrl ? ['VITE_SUPABASE_URL'] : []),
    ...(!supabaseAnonKey ? ['VITE_SUPABASE_ANON_KEY'] : []),
  ],
};

export const metaPixelId = import.meta.env.VITE_META_PIXEL_ID ?? '';
