import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type DeliveryResources = {
  folder_url: string;
  ebook_pdf_url: string;
  flashcards_pdf_url: string;
  expires_at: string;
};

const INVALID_LINK_MESSAGE = 'ডেলিভারি লিংকটি সঠিক নয়, মেয়াদ শেষ হয়েছে, অথবা বাতিল করা হয়েছে।';

export function CustomerDeliveryPage() {
  const { token } = useParams<{ token: string }>();
  const [resources, setResources] = useState<DeliveryResources | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setResources(null);
    setErrorMessage('');
    setLoading(true);

    if (!token || !/^[0-9a-f]{64}$/.test(token) || !supabase) {
      setErrorMessage(INVALID_LINK_MESSAGE);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<DeliveryResources & { error?: string }>(
          'get-customer-delivery',
          { body: { token } },
        );
        if (error || !data || data.error || !data.folder_url || !data.ebook_pdf_url || !data.flashcards_pdf_url || !data.expires_at) {
          if (active) setErrorMessage(data?.error || INVALID_LINK_MESSAGE);
          return;
        }
        if (active) setResources(data);
      } catch {
        if (active) setErrorMessage('ডেলিভারি লিংকটি এখন খোলা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <Link className="brand" to="/">
          <span className="brand-mark">স</span>
          <span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span>
        </Link>
        <h1>আপনার ডিজিটাল পণ্য</h1>
        {loading && <p role="status">ডেলিভারি লিংক যাচাই হচ্ছে…</p>}
        {!loading && errorMessage && <div className="form-alert" role="alert">{errorMessage}</div>}
        {!loading && resources && (
          <>
            <p>আপনার ফাইলগুলো নিচের লিংক থেকে খুলুন বা ডাউনলোড করুন।</p>
            <p>লিংকের মেয়াদ শেষ হবে: <time dateTime={resources.expires_at}>{new Date(resources.expires_at).toLocaleString('bn-BD')}</time></p>
            <div className="delivery-resources">
              <a className="button button-full" href={resources.ebook_pdf_url} target="_blank" rel="noreferrer">Ebook PDF খুলুন</a>
              <a className="button button-full" href={resources.flashcards_pdf_url} target="_blank" rel="noreferrer">Flashcards PDF খুলুন</a>
              <a className="text-link" href={resources.folder_url} target="_blank" rel="noreferrer">সম্পূর্ণ Drive folder খুলুন ↗</a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
