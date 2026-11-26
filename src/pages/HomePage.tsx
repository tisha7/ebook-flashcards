import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { FACEBOOK_URL, OFFER_EXPIRY_ISO, PRODUCT_NAME, PRODUCT_PRICE } from '../config';
import { trackInitiateCheckout, trackViewContent } from '../lib/pixel';

const techniques = [
  ['Serve & Return', 'শিশু কোনো শব্দ, ইশারা বা আগ্রহ দেখালে মনোযোগ দিয়ে সাড়া দিন—তারপর তার পরের প্রতিক্রিয়ার জন্য অপেক্ষা করুন।'],
  ['Parallel Talk', 'শিশু যা করছে, সেটি সহজ ভাষায় বলুন। একসঙ্গে খেলতে খেলতে শব্দের সঙ্গে কাজের যোগ তৈরি হয়।'],
  ['Self Talk', 'আপনি যা করছেন তা ছোট ছোট বাক্যে বলুন—যেমন, “আমি এখন পানি ঢালছি।”'],
  ['অপেক্ষার সময়', 'কথা বা প্রশ্নের পর কিছুটা নীরবতা দিন। প্রায় ১০ সেকেন্ড অপেক্ষা করে শিশুকে সাড়া দেওয়ার সুযোগ দিন।'],
  ['বেছে নেওয়ার সুযোগ', 'দুটি পরিচিত বিকল্প দেখিয়ে জিজ্ঞেস করুন—“আপেল, নাকি কলা?” উত্তর দেওয়ার জন্য সময় রাখুন।'],
  ['দৈনন্দিন রুটিন', 'খাওয়া, গোসল, পোশাক বা বই দেখার মতো চেনা মুহূর্তে কথা বলার সুযোগ খুঁজুন।'],
];

const chapters = [
  'শিশুর সঙ্গে যোগাযোগের ছোট ছোট মুহূর্ত',
  'শুনতে, দেখতে ও সাড়া দিতে শেখা',
  'খেলা ও দৈনন্দিন রুটিনে কথোপকথন',
  'বয়স অনুযায়ী সহজ ভাষার ব্যবহার',
  'বাড়িতে করার মতো বাস্তব উদাহরণ',
  '৫০টি ছবি-সহ প্রিন্টেবল ফ্ল্যাশকার্ড',
];

const faqs = [
  ['এই পণ্যে কী কী থাকছে?', 'বাংলা প্যারেন্টিং ইবুকের সঙ্গে ৫০টি A4 প্রিন্টেবল ফ্ল্যাশকার্ড থাকবে। অনুশীলন ট্র্যাকার ও শব্দের ডায়েরি ইবুকের ভেতরেই আছে।'],
  ['পণ্য কীভাবে পাব?', 'অ্যাডমিন আপনার পেমেন্ট যাচাই করার পর WhatsApp বা ইমেইলে ম্যানুয়ালি ডিজিটাল ফাইল পাঠানো হবে। যাচাইয়ের সময় ভিন্ন হতে পারে।'],
  ['কীভাবে পেমেন্ট করব?', 'bKash বা Nagad Send Money-তে ০১৮৬০২৭০০২৪ নম্বরে ৳২৪৯ পাঠান। এরপর চেকআউটে পেমেন্ট পদ্ধতি, প্রেরকের নম্বর ও Transaction ID দিন। পেমেন্ট স্বয়ংক্রিয়ভাবে নিশ্চিত হয় না; আমরা হাতে পাওয়া পেমেন্ট মিলিয়ে ম্যানুয়ালি যাচাই করি। PIN বা OTP কখনো দেবেন না।'],
  ['ফ্ল্যাশকার্ড কি প্রিন্ট করা যাবে?', 'হ্যাঁ। ৫০টি কার্ড A4 সাইজে প্রিন্ট করে পরিচিত বস্তুর নাম বলা, ছবি দেখা বা বেছে নেওয়ার খেলায় ব্যবহার করতে পারবেন।'],
  ['এটি কি স্পিচ থেরাপির বিকল্প?', 'না। এটি দৈনন্দিন যোগাযোগের কিছু ব্যবহারিক ধারণা দেয়; কোনো মূল্যায়ন, রোগনির্ণয় বা স্পিচ-ল্যাঙ্গুয়েজ থেরাপির বিকল্প নয়।'],
];

function OfferCountdown() {
  const expiry = OFFER_EXPIRY_ISO ? Date.parse(OFFER_EXPIRY_ISO) : Number.NaN;
  const [now, setNow] = useState(() => Date.now());
  const hasValidExpiry = Number.isFinite(expiry)
    && Boolean(OFFER_EXPIRY_ISO && /(?:Z|[+-]\d{2}:\d{2})$/i.test(OFFER_EXPIRY_ISO));
  const hasInvalidExpiry = OFFER_EXPIRY_ISO !== null && !hasValidExpiry;
  const remaining = Math.max(0, expiry - now);
  const expired = hasValidExpiry && remaining === 0;
  const parts = [
    { value: Math.floor(remaining / 86_400_000), label: 'দিন' },
    { value: Math.floor((remaining / 3_600_000) % 24), label: 'ঘণ্টা' },
    { value: Math.floor((remaining / 60_000) % 60), label: 'মিনিট' },
    { value: Math.floor((remaining / 1_000) % 60), label: 'সেকেন্ড' },
  ];

  useEffect(() => {
    if (!hasValidExpiry || Date.now() >= expiry) return;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= expiry) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [expiry, hasValidExpiry]);

  return (
    <div className={`offer-timer ${hasValidExpiry ? 'has-deadline' : 'no-deadline'}`}>
      {expired ? (
        <p>এই অফারের নির্ধারিত সময় শেষ হয়েছে। অর্ডারের আগে বর্তমান অফারটি নিশ্চিত করে নিন।</p>
      ) : hasValidExpiry ? (
        <>
          <p>এই অফারটি শেষ হতে বাকি</p>
          <div className="countdown-grid" role="timer" aria-label="অফার শেষ হতে বাকি সময়">
            {parts.map(({ value, label }) => (
              <div className="countdown-part" key={label}>
                <strong key={value}>{String(value).padStart(2, '0')}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p>{hasInvalidExpiry ? 'অফারের সময়সীমা এখনো নিশ্চিত নয়—এখানে কোনো কাউন্টডাউন দেখানো হচ্ছে না।' : 'এই মুহূর্তে কোনো নির্দিষ্ট শেষ-তারিখের অফার ঘোষণা করা হয়নি।'}</p>
      )}
    </div>
  );
}

export function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    trackViewContent();
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const sections = document.querySelectorAll<HTMLElement>('[data-reveal]');
    document.documentElement.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });

    sections.forEach((section) => observer.observe(section));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove('motion-ready');
    };
  }, []);

  function beginCheckout(): void {
    trackInitiateCheckout();
  }

  function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  return (
    <>
      <div className="announcement">
        <span>একটি ইবুক + ৫০টি প্রিন্টেবল ফ্ল্যাশকার্ড</span>
        <span className="announcement-separator">•</span>
        <span>সব মিলিয়ে ৳২৪৯</span>
      </div>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="সহজ প্যারেন্টিং হোম">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}assets/logo.jpg`} alt="সহজ প্যারেন্টিং লোগো" />
          <span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span>
        </Link>
        <nav className="desktop-nav" aria-label="প্রধান নেভিগেশন">
          <a href="#learn" onClick={(event) => scrollToSection(event, 'learn')}>ইবুকে যা আছে</a>
          <a href="#cards" onClick={(event) => scrollToSection(event, 'cards')}>ফ্ল্যাশকার্ড</a>
          <a href="#reviews" onClick={(event) => scrollToSection(event, 'reviews')}>গ্রাহকদের বার্তা</a>
          <a href="#faq" onClick={(event) => scrollToSection(event, 'faq')}>সাধারণ প্রশ্ন</a>
        </nav>
        <Link className="button button-small" to="/checkout" onClick={beginCheckout}>অর্ডার করুন <span aria-hidden="true">↗</span></Link>
      </header>

      <main>
        <section className="hero section-wrap" data-reveal>
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" />শিশুর সঙ্গে প্রতিদিনের কথোপকথন</p>
            <h1>প্রতিদিনের ছোট মুহূর্তে <em>ফুটুক নতুন বুলি</em></h1>
            <p className="hero-description">
              খেলা, গল্প আর চেনা রুটিনের মধ্যেই লুকিয়ে থাকে কথা বলার অনেক সুযোগ। সহজ বাংলার এই গাইডে পাবেন দৈনন্দিন জীবনে কাজে লাগানোর মতো কোমল, ব্যবহারিক ধারণা।
            </p>
            <div className="hero-actions">
              <Link className="button" to="/checkout" onClick={beginCheckout}>এখনই অর্ডার করুন <span aria-hidden="true">→</span></Link>
              <a className="text-link" href="#learn" onClick={(event) => scrollToSection(event, 'learn')}>ভেতরে কী আছে <span aria-hidden="true">↓</span></a>
            </div>
            <div className="hero-proof">
              <span className="proof-icon" aria-hidden="true">✓</span>
              <span>সহজ বাংলার গাইড</span><i />
              <span>৫০টি A4 কার্ড</span><i />
              <span>bKash / Nagad Send Money</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="cover-frame">
              <img
                src={`${import.meta.env.BASE_URL}assets/Ebook%20+%20flashcard%20cover.jpg`}
                alt="শিশুর মুখে ফুটুক বুলি বাংলা ইবুক ও ৫০টি প্রিন্টেবল ফ্ল্যাশকার্ডের সম্মিলিত কভার"
                fetchPriority="high"
              />
            </div>
            <div className="floating-card">
              <span className="floating-kicker">সম্পূর্ণ প্যাকেজ</span>
              <strong>৳২৪৯</strong>
              <span>ইবুক + ৫০টি কার্ড</span>
            </div>
            <div className="visual-caption">শিশুর মুখে ফুটুক বুলি • ইবুক ও ফ্ল্যাশকার্ড</div>
          </div>
        </section>

        <section className="trust-strip" aria-label="পণ্যের বৈশিষ্ট্য" data-reveal>
          <div><span className="trust-number">০১</span><span>সহজ বাংলায় লেখা</span></div>
          <div><span className="trust-number">০২</span><span>বাস্তব জীবনের উদাহরণ</span></div>
          <div><span className="trust-number">০৩</span><span>ডাউনলোডযোগ্য ডিজিটাল পণ্য</span></div>
          <div><span className="trust-number">০৪</span><span>একবারের মূল্য ৳২৪৯</span></div>
        </section>

        <section className="intro-section section-wrap" data-reveal>
          <div className="section-label">একসঙ্গে থাকার সময়টুকু</div>
          <div className="intro-grid">
            <h2>কথা শুরু করার সুযোগ<br /><em>আছে চেনা মুহূর্তেই।</em></h2>
            <div>
              <p>শিশু হয়তো কোনো শব্দ, ইশারা বা কৌতূহল দিয়ে কথার শুরু করে—কখনো আবার আমরা বুঝতে পারি না, কীভাবে সাড়া দেব। এমন দ্বিধা অনেক পরিবারেরই পরিচিত।</p>
              <p>এই গাইডে আছে মনোযোগ দিয়ে শোনা, পালা করে সাড়া দেওয়া ও রুটিনে কথা জুড়ে দেওয়ার মতো ধারণা—চাপ ছাড়া, পরিবারের নিজের গতিতে।</p>
            </div>
          </div>
        </section>

        <section className="empathy-section" data-reveal>
          <div className="section-wrap empathy-grid">
            <div>
              <p className="eyebrow eyebrow-light"><span className="eyebrow-line" />আপনার অনুভূতিও গুরুত্বপূর্ণ</p>
              <h2>কখনো কি মনে হয়,<br />“আমি কীভাবে শুরু করব?”</h2>
              <p className="empathy-lead">অভিভাবকত্বে অনেক প্রশ্ন থাকা স্বাভাবিক। সব সময় সঠিক শব্দ খুঁজে পাওয়া বা নতুন খেলা ভাবা সহজ নয়।</p>
              <p>এই বইটি কোনো পরীক্ষা বা প্রতিশ্রুতি নয়—এটি পাশে রাখার মতো একটি ব্যবহারিক সহায়িকা, যাতে পরিচিত মুহূর্তে কথোপকথন শুরু করার কয়েকটি ধারণা থাকে।</p>
            </div>
            <div className="empathy-card">
              <span className="quote-mark" aria-hidden="true">“</span>
              <p>সব উত্তর একদিনে খুঁজে পেতে হবে না। মনোযোগ দিয়ে পাশে থাকা—সেখান থেকেই শুরু।</p>
              <span className="empathy-rule" />
              <small>সহজ প্যারেন্টিং-এর ভাবনা</small>
            </div>
          </div>
        </section>

        <section className="learn-section section-wrap" id="learn" data-reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" />ইবুকের ভেতরে</p>
              <h2>ছোট কৌশল, <em>প্রতিদিনের জন্য</em></h2>
            </div>
            <p>কথা বলার সুযোগ তৈরি করতে যা যা জানতে পারবেন</p>
          </div>
          <div className="technique-grid">
            {techniques.map(([title, description], index) => (
              <article className="technique-card" key={title}>
                <span className="card-index">০{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="card-arrow" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>
        </section>

        <section className="chapters-section" data-reveal>
          <div className="section-wrap chapters-layout">
            <div className="chapters-intro">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-line" />এক নজরে</p>
              <h2>কী কী থাকছে<br />এই গাইডে?</h2>
              <p>পরিবারের নিজের গতিতে পড়ুন, বেছে নিন, কাজে লাগান।</p>
              <Link className="button button-light" to="/checkout" onClick={beginCheckout}>পুরো প্যাকেজ দেখুন <span aria-hidden="true">→</span></Link>
            </div>
            <ol className="chapter-list">
              {chapters.map((chapter, index) => (
                <li key={chapter}><span>{String(index + 1).padStart(2, '0')}</span>{chapter}<b aria-hidden="true">↗</b></li>
              ))}
            </ol>
          </div>
        </section>

        <section className="flashcards-section section-wrap" id="cards" data-reveal>
          <div className="flashcard-visual">
            <img
              src={`${import.meta.env.BASE_URL}assets/flashcard%20cover.jpg`}
              alt="৫০টি বাংলা শব্দ-লেবেলসহ বাস্তব ছবির প্রিন্টেবল ফ্ল্যাশকার্ডের কভার"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flashcard-copy">
            <p className="eyebrow"><span className="eyebrow-line" />ফ্ল্যাশকার্ড শোকেস</p>
            <h2>৫০টি A4 কার্ড,<br /><em>দেখুন, বলুন, বেছে নিন</em></h2>
            <p>বাস্তব ছবির সঙ্গে বাংলা শব্দ-লেবেল। পরিচিত বস্তু নিয়ে কথা বলা, একসঙ্গে ছবি দেখা বা শিশুকে বেছে নেওয়ার সুযোগ দিতে কার্ডগুলো প্রিন্ট করে ব্যবহার করুন।</p>
            <div className="card-pills"><span>৫০টি কার্ড</span><span>A4 সাইজে প্রিন্ট</span><span>বাস্তব ছবি ও বাংলা শব্দ</span></div>
            <Link className="text-link" to="/checkout" onClick={beginCheckout}>প্যাকেজটি অর্ডার করুন <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="ebook-preview-section section-wrap" data-reveal>
          <div className="ebook-preview-copy">
            <p className="eyebrow"><span className="eyebrow-line" />ইবুক প্রিভিউ</p>
            <h2>পাশে রাখার মতো<br /><em>একটি সহজ গাইড</em></h2>
            <p>বাংলায় লেখা ব্যবহারিক প্যারেন্টিং ইবুকটি পড়ুন নিজের সুবিধামতো। এতে আছে প্রতিদিনের যোগাযোগের কৌশল, অনুশীলন ট্র্যাকার ও শব্দের ডায়েরি—সবই ইবুকের ভেতরে।</p>
            <span className="preview-note">এখানে সরবরাহকৃত ইবুকের কভার/ডিজিটাল মকআপ দেখানো হয়েছে; ভেতরের পৃষ্ঠার আলাদা প্রিভিউ নেই।</span>
          </div>
          <div className="ebook-preview-visual">
            <img
              src={`${import.meta.env.BASE_URL}assets/ebookvisual.jpg`}
              alt="শিশুর মুখে ফুটুক বুলি ইবুকের ট্যাবলেট ও মোবাইল ডিজিটাল মকআপ"
              loading="lazy"
              decoding="async"
            />
          </div>
        </section>

        <section className="reviews-section section-wrap" id="reviews" data-reveal>
          <div className="section-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-line" />পাঠকদের কাছ থেকে</p>
              <h2>গ্রাহকদের <em>নিজেদের বার্তা</em></h2>
            </div>
            <p>গ্রাহকদের পাঠানো বার্তার আসল স্ক্রিনশট</p>
          </div>
          <div className="review-grid">
            <figure className="review-card">
              <img
                src={`${import.meta.env.BASE_URL}assets/cus_review_1.jpg`}
                alt="গ্রাহকের পাঠানো বাংলা বার্তার স্ক্রিনশট"
                loading="lazy"
                decoding="async"
              />
            </figure>
            <figure className="review-card">
              <img
                src={`${import.meta.env.BASE_URL}assets/cus_review_2.jpg`}
                alt="গ্রাহকের পাঠানো বাংলা বার্তার স্ক্রিনশট"
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </section>

        <section className="offer-section" id="offer" data-reveal>
          <div className="section-wrap offer-layout">
            <div className="offer-copy">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-line" />একসঙ্গে সম্পূর্ণ প্যাকেজ</p>
              <h2>শিশুর মুখে ফুটুক বুলি</h2>
              <ul>
                <li><span>✓</span>{PRODUCT_NAME} বাংলা ইবুক</li>
                <li><span>✓</span>৫০টি A4 সাইজের প্রিন্টেবল ফ্ল্যাশকার্ড</li>
                <li><span>✓</span>ইবুকের ভেতরে অনুশীলন ট্র্যাকার ও শব্দের ডায়েরি</li>
                <li><span>✓</span>পেমেন্ট যাচাইয়ের পর WhatsApp বা ইমেইলে ডেলিভারি</li>
              </ul>
            </div>
            <div className="price-card">
              <span className="price-overline">একসঙ্গে সম্পূর্ণ প্যাকেজ</span>
              <h3>{PRODUCT_NAME}<br /><span>৫০টি Printable Flashcards</span></h3>
              <p className="price">৳{PRODUCT_PRICE.toLocaleString('bn-BD')}<small> BDT</small></p>
              <p className="price-note">সম্পূর্ণ প্যাকেজের একবারের মূল্য</p>
              <OfferCountdown />
              <Link className="button button-full" to="/checkout" onClick={beginCheckout}>এখনই অর্ডার করুন <span aria-hidden="true">→</span></Link>
              <div className="secure-note"><span aria-hidden="true">◇</span> bKash অথবা Nagad Send Money</div>
            </div>
          </div>
        </section>

        <section className="faq-section section-wrap" id="faq" data-reveal>
          <div className="faq-title">
            <p className="eyebrow"><span className="eyebrow-line" />আপনার প্রশ্ন</p>
            <h2>জানতে চান<br /><em>আরও কিছু?</em></h2>
            <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">ফেসবুকে যোগাযোগ করুন <span aria-hidden="true">↗</span></a>
          </div>
          <div className="faq-list">
            {faqs.map(([question, answer], index) => (
              <article className={`faq-item ${openFaq === index ? 'is-open' : ''}`} key={question}>
                <h3>
                  <button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>
                    <span>{question}</span><b aria-hidden="true">{openFaq === index ? '−' : '+'}</b>
                  </button>
                </h3>
                <div className="faq-answer" aria-hidden={openFaq !== index}>
                  <div><p>{answer}</p></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="disclaimer">
          <div className="section-wrap disclaimer-inner">
            <span className="disclaimer-mark" aria-hidden="true">i</span>
            <div><strong>একটি গুরুত্বপূর্ণ কথা</strong><p>এই ইবুকটি সাধারণ শিক্ষামূলক তথ্য ও দৈনন্দিন যোগাযোগের ধারণা দেয়। এটি চিকিৎসা পরামর্শ নয় এবং পেশাদার developmental evaluation বা speech-language therapy-এর বিকল্প নয়। শিশুর বিকাশ বা যোগাযোগ নিয়ে উদ্বেগ থাকলে যোগ্য স্বাস্থ্য বা স্পিচ-ল্যাঙ্গুয়েজ পেশাজীবীর পরামর্শ নিন। কোনো ফলাফলের নিশ্চয়তা দেওয়া হয় না।</p></div>
          </div>
        </section>
      </main>

      <div className="mobile-buy-bar">
        <span><small>সম্পূর্ণ প্যাকেজ</small><strong>৳{PRODUCT_PRICE.toLocaleString('bn-BD')}</strong></span>
        <Link className="button" to="/checkout" onClick={beginCheckout}>এখনই অর্ডার করুন <span aria-hidden="true">→</span></Link>
      </div>

      <footer className="site-footer">
        <div className="section-wrap footer-main" data-reveal>
          <Link className="brand brand-footer" to="/">
            <img className="brand-logo" src={`${import.meta.env.BASE_URL}assets/logo.jpg`} alt="সহজ প্যারেন্টিং লোগো" />
            <span><strong>সহজ প্যারেন্টিং</strong><small>প্রতিদিনের জীবনের জন্য সহজ ধারণা</small></span>
          </Link>
          <p>অভিভাবকত্বের পথে<br />একটু সহজ, একটু আপন।</p>
          <a className="footer-social" href={FACEBOOK_URL} target="_blank" rel="noreferrer">ফেসবুকে আমাদের খুঁজুন <span aria-hidden="true">↗</span></a>
        </div>
        <div className="section-wrap footer-bottom"><span>© {new Date().getFullYear()} Sohoj Parenting</span><Link to="/admin">Admin</Link><span>বাংলাদেশ থেকে ভালোবাসায়</span></div>
      </footer>
    </>
  );
}
