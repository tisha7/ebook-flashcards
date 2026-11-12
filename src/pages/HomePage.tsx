import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BUNDLE_NAME, FACEBOOK_URL, PRODUCT_NAME, PRODUCT_PRICE } from '../config';
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
  ['এই পণ্যে কী কী থাকছে?', 'বাংলা প্যারেন্টিং ইবুকের সঙ্গে ৫০টি প্রিন্টেবল ফ্ল্যাশকার্ড—প্রতিটি কার্ডে বাস্তব ছবির প্রিভিউ ও বাংলা লেবেল থাকবে।'],
  ['কীভাবে পেমেন্ট করব?', 'bKash বা Nagad Send Money করে চেকআউট ফর্মে পেমেন্ট পদ্ধতি, প্রেরকের নম্বর ও Transaction ID দিন। পেমেন্ট হাতে পাওয়ার সঙ্গে সঙ্গে স্বয়ংক্রিয়ভাবে নিশ্চিত হয় না; আমরা ম্যানুয়ালি যাচাই করি।'],
  ['পেমেন্টের পর কখন ফাইল পাব?', 'অ্যাডমিন পেমেন্ট যাচাই করার পর WhatsApp বা ইমেইলে ম্যানুয়ালি ফাইল পাঠানো হবে। যাচাইয়ের সময় ভিন্ন হতে পারে।'],
  ['এটি কি স্পিচ থেরাপির বিকল্প?', 'না। এটি দৈনন্দিন যোগাযোগের কিছু ব্যবহারিক ধারণা দেয়; কোনো মূল্যায়ন, রোগনির্ণয় বা স্পিচ-ল্যাঙ্গুয়েজ থেরাপির বিকল্প নয়।'],
  ['ফ্ল্যাশকার্ড কীভাবে ব্যবহার করব?', 'কার্ডগুলো প্রিন্ট করে পরিচিত বস্তুর নাম বলা, একসঙ্গে ছবি দেখা বা বেছে নেওয়ার খেলায় ব্যবহার করা যায়। শিশুর আগ্রহ ও স্বাচ্ছন্দ্যকে গুরুত্ব দিন।'],
];

export function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    trackViewContent();
  }, []);

  function beginCheckout(): void {
    trackInitiateCheckout();
  }

  return (
    <>
      <div className="announcement">
        <span>সহজ প্যারেন্টিং</span>
        <span className="announcement-separator">•</span>
        <span>পরিবারের প্রতিদিনের মুহূর্তে সহজ যোগাযোগ</span>
      </div>
      <header className="site-header">
        <a className="brand" href="#/" aria-label="সহজ প্যারেন্টিং হোম">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}assets/logo.jpg`} alt="" />
          <span><strong>সহজ প্যারেন্টিং</strong><small>SOHOJ PARENTING</small></span>
        </a>
        <nav className="desktop-nav" aria-label="প্রধান নেভিগেশন">
          <a href="#learn">ইবুকে যা আছে</a>
          <a href="#cards">ফ্ল্যাশকার্ড</a>
          <a href="#reviews">গ্রাহকদের বার্তা</a>
          <a href="#faq">সাধারণ প্রশ্ন</a>
        </nav>
        <Link className="button button-small" to="/checkout" onClick={beginCheckout}>কিনুন <span aria-hidden="true">↗</span></Link>
      </header>

      <main>
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-line" />প্রতিদিনের ছোট মুহূর্ত, আরও অর্থবহ</p>
            <h1>শিশুর সঙ্গে কথা বলার <em>সহজ উপায়</em></h1>
            <p className="hero-description">
              একসঙ্গে খেলা, গল্প আর দৈনন্দিন কাজের ভেতরেই তৈরি হয় যোগাযোগের সুযোগ। বাস্তব জীবনে কাজে লাগানো যায়—এমন কিছু ধারণা নিয়ে এই বাংলা ইবুক।
            </p>
            <div className="hero-actions">
              <Link className="button" to="/checkout" onClick={beginCheckout}>ইবুক ও কার্ড সংগ্রহ করুন <span aria-hidden="true">→</span></Link>
              <a className="text-link" href="#learn">ভেতরে কী আছে <span aria-hidden="true">↓</span></a>
            </div>
            <div className="hero-proof">
              <span className="proof-icon" aria-hidden="true">✓</span>
              <span>বাংলায় ব্যবহারিক গাইড</span><i />
              <span>৫০টি প্রিন্টেবল কার্ড</span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="cover-frame">
              <img
                src={`${import.meta.env.BASE_URL}assets/ebookvisual.jpg`}
                alt="শিশুর মুখে ফুটুক বুলি ইবুকের ট্যাবলেট ও মোবাইল মকআপ"
                fetchPriority="high"
              />
            </div>
            <div className="floating-card">
              <span className="floating-kicker">সঙ্গে থাকছে</span>
              <strong>৫০টি</strong>
              <span>প্রিন্টেবল ফ্ল্যাশকার্ড</span>
            </div>
            <div className="visual-caption">শিশুর মুখে ফুটুক বুলি • ইবুক প্রিভিউ</div>
          </div>
        </section>

        <section className="trust-strip" aria-label="পণ্যের বৈশিষ্ট্য">
          <div><span className="trust-number">০১</span><span>সহজ বাংলায় লেখা</span></div>
          <div><span className="trust-number">০২</span><span>বাস্তব জীবনের উদাহরণ</span></div>
          <div><span className="trust-number">০৩</span><span>ডাউনলোডযোগ্য ডিজিটাল পণ্য</span></div>
          <div><span className="trust-number">০৪</span><span>একবারের মূল্য ৳২৪৯</span></div>
        </section>

        <section className="intro-section section-wrap">
          <div className="section-label">একসঙ্গে থাকার সময়টুকু</div>
          <div className="intro-grid">
            <h2>শেখা শুরু হয়<br /><em>দৈনন্দিন জীবনেই।</em></h2>
            <div>
              <p>খেলনা গুছানো, খাবার ভাগ করে নেওয়া বা জানালার বাইরে তাকানো—শিশুর সঙ্গে যোগাযোগের ছোট সুযোগ অনেক সময় আমাদের চোখ এড়িয়ে যায়।</p>
              <p>এই গাইডে আছে এমন কিছু কোমল, ব্যবহারিক কৌশল যা পরিবারের স্বাভাবিক দিনযাপনের সঙ্গে মানিয়ে নেওয়া যায়—কোনো চাপ বা নিখুঁত হওয়ার প্রত্যাশা ছাড়াই।</p>
            </div>
          </div>
        </section>

        <section className="empathy-section">
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

        <section className="learn-section section-wrap" id="learn">
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

        <section className="chapters-section">
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

        <section className="flashcards-section section-wrap" id="cards">
          <div className="flashcard-visual">
            <img
              src={`${import.meta.env.BASE_URL}assets/731147088_122109162039360440_8542055519548742110_n.jpg`}
              alt="শিশুর মুখে ফুটুক বুলি ইবুকের ডিজিটাল কভার প্রিভিউ"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="flashcard-copy">
            <p className="eyebrow"><span className="eyebrow-line" />ইবুক ও ফ্ল্যাশকার্ড প্যাকেজ</p>
            <h2>৫০টি ছবির কার্ড,<br /><em>একসঙ্গে শেখার জন্য</em></h2>
            <p>বাস্তব ছবির সঙ্গে বাংলা শব্দ—পরিচিত বস্তু নিয়ে কথা বলা, ছবি দেখানো বা শিশুকে বেছে নেওয়ার সুযোগ দেওয়ার জন্য তৈরি। নিজের সুবিধায় প্রিন্ট করে ব্যবহার করুন।</p>
            <div className="card-pills"><span>৫০টি কার্ড</span><span>বাংলা লেবেল</span><span>প্রিন্টেবল</span></div>
            <span className="asset-note">কার্ডের আলাদা প্রিভিউ ছবি এখানে সরবরাহ করা হয়নি।</span>
          </div>
        </section>

        <section className="reviews-section section-wrap" id="reviews">
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

        <section className="offer-section" id="offer">
          <div className="section-wrap offer-layout">
            <div className="offer-copy">
              <p className="eyebrow eyebrow-light"><span className="eyebrow-line" />একটি প্যাকেজে</p>
              <h2>আপনার পরিবারের<br />জন্য একটি সহজ শুরু</h2>
              <ul>
                <li><span>✓</span>{PRODUCT_NAME} বাংলা ইবুক</li>
                <li><span>✓</span>৫০টি প্রিন্টেবল ফ্ল্যাশকার্ড</li>
                <li><span>✓</span>প্রতিদিনের রুটিনে ব্যবহারযোগ্য ধারণা</li>
                <li><span>✓</span>WhatsApp বা ইমেইলে ম্যানুয়াল ডেলিভারি</li>
              </ul>
            </div>
            <div className="price-card">
              <span className="price-overline">ডিজিটাল প্যাকেজ</span>
              <h3>{BUNDLE_NAME}</h3>
              <p className="price">৳{PRODUCT_PRICE.toLocaleString('bn-BD')}<small> BDT</small></p>
              <p className="price-note">একবারের মূল্য • পেমেন্ট যাচাইয়ের পর ম্যানুয়াল ডেলিভারি</p>
              <Link className="button button-full" to="/checkout" onClick={beginCheckout}>চেকআউটে এগিয়ে যান <span aria-hidden="true">→</span></Link>
              <div className="secure-note"><span aria-hidden="true">◇</span> bKash অথবা Nagad Send Money</div>
            </div>
          </div>
        </section>

        <section className="faq-section section-wrap" id="faq">
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
                {openFaq === index && <p>{answer}</p>}
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

      <footer className="site-footer">
        <div className="section-wrap footer-main">
          <a className="brand brand-footer" href="#/">
            <img className="brand-logo" src={`${import.meta.env.BASE_URL}assets/logo.jpg`} alt="" />
            <span><strong>সহজ প্যারেন্টিং</strong><small>প্রতিদিনের জীবনের জন্য সহজ ধারণা</small></span>
          </a>
          <p>অভিভাবকত্বের পথে<br />একটু সহজ, একটু আপন।</p>
          <a className="footer-social" href={FACEBOOK_URL} target="_blank" rel="noreferrer">ফেসবুকে আমাদের খুঁজুন <span aria-hidden="true">↗</span></a>
        </div>
        <div className="section-wrap footer-bottom"><span>© {new Date().getFullYear()} Sohoj Parenting</span><Link to="/admin">Admin</Link><span>বাংলাদেশ থেকে ভালোবাসায়</span></div>
      </footer>
    </>
  );
}
