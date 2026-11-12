export const PRODUCT_PRICE = 249;
export const PRODUCT_NAME = 'শিশুর মুখে ফুটুক বুলি';
export const BUNDLE_NAME = 'ইবুক + ৫০টি প্রিন্টেবল ফ্ল্যাশকার্ড';
export const FACEBOOK_URL =
  'https://www.facebook.com/p/Sohoj-Parenting-61590813201845/';

export const paymentConfig = {
  receiverNumber: '01860270024',
  accountType: 'অ্যাকাউন্টের ধরন যাচাই করে নিন',
};

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
  isConfigured: Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY,
  ),
};

export const metaPixelId = import.meta.env.VITE_META_PIXEL_ID ?? '';
