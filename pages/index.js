import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

// ── Constants ──────────────────────────────────────────────────────────────
const EMOTIONS = [
  { id: 'happy',   name: '행복',   color: '#FFD700', dark: '#B8960A' },
  { id: 'excited', name: '설렘',   color: '#FF69B4', dark: '#C0306A' },
  { id: 'calm',    name: '평온',   color: '#00C87A', dark: '#007A4A' },
  { id: 'joy',     name: '즐거움', color: '#FF8C00', dark: '#B85E00' },
  { id: 'sad',     name: '슬픔',   color: '#1E90FF', dark: '#0050C0' },
  { id: 'angry',   name: '분노',   color: '#FF4500', dark: '#B02000' },
  { id: 'anxious', name: '불안',   color: '#9370DB', dark: '#5A3090' },
  { id: 'tired',   name: '무기력', color: '#8899AA', dark: '#4A5A6A' },
];

const MAX_MARBLES = 20;
const MARBLE_SIZES = [30, 26, 28, 24, 32, 26, 28, 30, 24, 28, 26, 30, 28, 24, 32, 28, 26, 30, 24, 28];

// ── Helpers ────────────────────────────────────────────────────────────────
function darken(hex, f = 0.55) {
  const r = Math.floor(parseInt(hex.slice(1, 3), 16) * f);
  const g = Math.floor(parseInt(hex.slice(3, 5), 16) * f);
  const b = Math.floor(parseInt(hex.slice(5, 7), 16) * f);
  return `rgb(${r},${g},${b})`;
}

function getMarbleStyle(color, size) {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    position: 'relative',
    background: `radial-gradient(circle at 32% 30%,
      rgba(255,255,255,0.92) 0%,
      rgba(255,255,255,0.45) 12%,
      ${color}EE 30%,
      ${color}BB 55%,
      ${color}88 74%,
      ${darken(color)} 100%
    )`,
    boxShadow: `
      inset -${size * 0.08}px -${size * 0.08}px ${size * 0.18}px rgba(0,0,0,0.2),
      inset ${size * 0.08}px ${size * 0.08}px ${size * 0.18}px rgba(255,255,255,0.65),
      0 0 ${size * 0.5}px ${color}55,
      0 ${size * 0.1}px ${size * 0.35}px rgba(0,0,0,0.18)
    `,
    cursor: 'pointer',
    transition: 'transform 0.18s ease',
  };
}

function getTimeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${d}일 전`;
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function encodeJar(data) {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  } catch { return null; }
}

function decodeJar(str) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(str))));
  } catch { return null; }
}

// ── Marble Component ───────────────────────────────────────────────────────
function Marble({ marble, index, showTooltip = true }) {
  const [hovered, setHovered] = useState(false);
  const emotion = EMOTIONS.find(e => e.id === marble.emotion);
  const size = MARBLE_SIZES[index % MARBLE_SIZES.length];

  return (
    <div
      style={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(v => !v)}
    >
      <div style={{
        ...getMarbleStyle(emotion.color, size),
        transform: hovered ? 'scale(1.18) translateY(-2px)' : 'scale(1)',
        zIndex: hovered ? 10 : 1,
      }} />
      {showTooltip && hovered && (
        <div style={{
          position: 'absolute',
          bottom: '120%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,252,255,0.98)',
          border: '1px solid rgba(160,140,220,0.3)',
          borderRadius: 14,
          padding: '12px 14px',
          width: 190,
          fontSize: 12,
          color: '#2a2050',
          zIndex: 200,
          boxShadow: '0 8px 32px rgba(124,92,191,0.18)',
          lineHeight: 1.55,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 10, color: '#9378c8', marginBottom: 4, fontWeight: 600, letterSpacing: 0.5 }}>
            {emotion.name} · {formatDate(marble.customDate || marble.ts)}
          </div>
          <div style={{ color: '#2a2050', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'hidden' }}>
            {marble.text || '(내용 없음)'}
          </div>
          <div style={{ fontSize: 10, color: '#b0a0d0', marginTop: 6 }}>
            {marble.anon ? '익명' : '나'} · {getTimeAgo(marble.ts)}
          </div>
          {/* Arrow */}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid rgba(160,140,220,0.3)' }} />
        </div>
      )}
    </div>
  );
}

// ── Mini Jar Component (for record tab preview) ────────────────────────────
function MiniJar({ marbles, animatingColor }) {
  return (
    <div style={{ width: '100%', background: 'rgba(180,160,255,0.07)', border: '1px solid rgba(160,140,220,0.2)', borderRadius: 20, padding: '16px', marginBottom: 16, minHeight: 100 }}>
      <div style={{ fontSize: 11, color: '#b0a0d0', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' }}>현재 병 미리보기</div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 5,
        justifyContent: 'center', alignContent: 'flex-end',
        minHeight: 60, padding: '4px 8px',
      }}>
        {marbles.length === 0
          ? <p style={{ fontSize: 12, color: '#c0b0e0', alignSelf: 'center', textAlign: 'center', width: '100%' }}>기록하면 여기 구슬이 담겨요 ✦</p>
          : marbles.map((m, i) => {
              const e = EMOTIONS.find(x => x.id === m.emotion);
              const s = Math.round(MARBLE_SIZES[i % MARBLE_SIZES.length] * 0.75);
              return <div key={m.id} style={{ ...getMarbleStyle(e.color, s), transition: 'none' }} />;
            })
        }
        {animatingColor && (
          <div style={{
            ...getMarbleStyle(animatingColor, 20),
            animation: 'popIn 0.5s ease forwards',
            opacity: 0,
          }} />
        )}
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#b0a0d0' }}>
        {marbles.length} / {MAX_MARBLES}개
      </div>
    </div>
  );
}

// ── Shared View ────────────────────────────────────────────────────────────
function SharedView({ data, onGoMain }) {
  const d = new Date(data.createdAt || Date.now());
  return (
    <div style={{ minHeight: '100vh', background: '#f0eeff', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px 60px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🫙</div>
        <h2 style={{ color: '#7c5cbf', fontSize: 20, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>공유된 감정 구슬 병</h2>
        <p style={{ color: '#a090c0', fontSize: 12 }}>
          {d.getFullYear()}년 {d.getMonth() + 1}월 · {data.marbles.length}개의 구슬
        </p>
        <p style={{ color: '#c0b0d8', fontSize: 11, marginTop: 4 }}>구슬을 터치하면 감정이 보여요</p>
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        justifyContent: 'center', maxWidth: 340,
        background: 'rgba(180,160,255,0.08)',
        border: '1px solid rgba(160,140,220,0.2)',
        borderRadius: 24, padding: '24px 20px',
        marginBottom: 32, alignContent: 'flex-end', minHeight: 120,
      }}>
        {data.marbles.map((m, i) => <Marble key={m.id || i} marble={m} index={i} />)}
      </div>
      <button onClick={onGoMain} style={{
        padding: '14px 36px', background: 'linear-gradient(135deg, #7c5cbf, #4e8de8)',
        border: 'none', borderRadius: 20, color: '#fff',
        fontSize: 15, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 6px 24px rgba(124,92,191,0.35)',
        fontFamily: 'inherit', letterSpacing: 0.5,
      }}>
        ✦ 나도 구슬 만들기
      </button>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();

  const [marbles, setMarbles] = useState([]);
  const [archives, setArchives] = useState([]);
  const [tab, setTab] = useState('jar');
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [memo, setMemo] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [notif, setNotif] = useState('');
  const [sharedData, setSharedData] = useState(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle'); // idle | copying | done | error
  const [shareLink, setShareLink] = useState('');
  const [animColor, setAnimColor] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const notifTimer = useRef(null);

  // ── Init ──
  useEffect(() => {
    setIsClient(true);
    try {
      const m = localStorage.getItem('em_marbles');
      const a = localStorage.getItem('em_archives');
      if (m) setMarbles(JSON.parse(m));
      if (a) setArchives(JSON.parse(a));
    } catch {}
  }, []);

  // Set default date
  useEffect(() => {
    if (isClient) {
      const today = new Date().toISOString().split('T')[0];
      setCustomDate(today);
    }
  }, [isClient]);

  // ── Detect shared jar from URL ──
  useEffect(() => {
    if (!router.isReady) return;
    const { jar } = router.query;
    if (jar) {
      const decoded = decodeJar(jar);
      if (decoded && decoded.marbles) {
        setSharedData(decoded);
        setIsSharedView(true);
      }
    }
  }, [router.isReady, router.query]);

  function persist(m, a) {
    try {
      localStorage.setItem('em_marbles', JSON.stringify(m));
      localStorage.setItem('em_archives', JSON.stringify(a));
    } catch {}
  }

  function showNotif(msg) {
    setNotif(msg);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(''), 3000);
  }

  function addMarble() {
    if (!memo.trim() || !selectedEmotion) return;
    const e = EMOTIONS.find(x => x.id === selectedEmotion);

    // Animate
    setAnimColor(e.color);
    setTimeout(() => setAnimColor(null), 800);

    const newMarble = {
      id: Date.now(),
      emotion: selectedEmotion,
      text: memo.trim(),
      anon: isAnon,
      ts: Date.now(),
      customDate: customDate ? new Date(customDate).getTime() : Date.now(),
    };

    let newMarbles = [...marbles, newMarble];
    let newArchives = archives;

    if (newMarbles.length >= MAX_MARBLES) {
      newArchives = [...archives, { marbles: newMarbles, completedAt: Date.now() }];
      newMarbles = [];
      showNotif('🎉 병이 가득 찼어요! 보관함으로 이동했어요');
    } else {
      showNotif(`✨ ${e.name} 구슬이 병에 담겼어요`);
    }

    setMarbles(newMarbles);
    setArchives(newArchives);
    persist(newMarbles, newArchives);
    setMemo('');
    setSelectedEmotion(null);
    const today = new Date().toISOString().split('T')[0];
    setCustomDate(today);
  }

  // ── Share logic (robust, no failures) ──
  function buildShareLink() {
    if (!isClient || marbles.length === 0) return '';
    const payload = encodeJar({ marbles, createdAt: Date.now() });
    if (!payload) return '';
    const base = window.location.origin + window.location.pathname;
    return `${base}?jar=${payload}`;
  }

  function handleShareTab() {
    setTab('share');
    const link = buildShareLink();
    setShareLink(link);
  }

  async function copyShareLink() {
    if (!shareLink) return;
    setCopyStatus('copying');
    let success = false;

    // Method 1: Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareLink);
        success = true;
      } catch {}
    }

    // Method 2: execCommand fallback
    if (!success) {
      try {
        const ta = document.createElement('textarea');
        ta.value = shareLink;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        success = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {}
    }

    // Method 3: prompt fallback
    if (!success) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
      window.prompt('아래 링크를 직접 복사해주세요 (Ctrl+C / Cmd+C):', shareLink);
      return;
    }

    setCopyStatus('done');
    setTimeout(() => setCopyStatus('idle'), 2500);
  }

  function handleGoMain() {
    setIsSharedView(false);
    setSharedData(null);
    router.replace('/', undefined, { shallow: true });
  }

  // ── Shared view ──
  if (isSharedView && sharedData) {
    return (
      <>
        <Head>
          <title>Emotion Marbles — 공유된 병</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        </Head>
        <SharedView data={sharedData} onGoMain={handleGoMain} />
        <GlobalStyles />
      </>
    );
  }

  const canSubmit = !!selectedEmotion && memo.trim().length > 0 && marbles.length < MAX_MARBLES;

  // ── Render ──
  return (
    <>
      <Head>
        <title>Emotion Marbles</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <meta name="description" content="당신의 감정을 구슬에 담아 보관하는 감성 기록 서비스" />
      </Head>
      <GlobalStyles />

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <h1>Emotion Marbles</h1>
          <p>당신의 감정을 구슬에 담아 보관하세요</p>
        </header>

        {/* Tabs */}
        <nav className="tab-nav">
          {[['jar', '🫙', '나의 병'], ['add', '✦', '기록'], ['share', '↗', '공유'], ['archive', '◎', '보관함']].map(([id, icon, label]) => (
            <button
              key={id}
              className={`tab-btn ${tab === id ? 'active' : ''}`}
              onClick={() => id === 'share' ? handleShareTab() : setTab(id)}
            >
              <span className="tab-icon">{icon}</span>
              <span className="tab-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* ── JAR TAB ── */}
        {tab === 'jar' && (
          <div className="tab-content">
            <div className="jar-section">
              <div className="jar-label">
                {marbles.length > 0
                  ? `${new Date(marbles[0].customDate || marbles[0].ts).getFullYear()}년 ${new Date(marbles[0].customDate || marbles[0].ts).getMonth() + 1}월의 기억`
                  : '현재 병'}
              </div>
              <div className="jar-glass">
                <div className="marbles-wrap">
                  {marbles.length === 0
                    ? <p className="empty-hint">아직 구슬이 없어요<br /><span style={{ fontSize: 11 }}>'기록' 탭에서 감정을 담아보세요</span></p>
                    : marbles.map((m, i) => <Marble key={m.id} marble={m} index={i} />)
                  }
                </div>
              </div>
              <div className="capacity-row">
                <span>{marbles.length} / {MAX_MARBLES}</span>
                <div className="capacity-bar">
                  <div className="capacity-fill" style={{ width: `${(marbles.length / MAX_MARBLES) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ADD TAB ── */}
        {tab === 'add' && (
          <div className="tab-content">
            {/* Mini jar preview */}
            <MiniJar marbles={marbles} animatingColor={animColor} />

            <div className="section-title">감정 선택</div>
            <div className="emotion-grid">
              {EMOTIONS.map(e => (
                <button
                  key={e.id}
                  className={`emotion-btn ${selectedEmotion === e.id ? 'selected' : ''}`}
                  style={selectedEmotion === e.id ? {
                    borderColor: e.color + 'AA',
                    boxShadow: `0 6px 20px ${e.color}30`,
                  } : {}}
                  onClick={() => setSelectedEmotion(e.id)}
                >
                  <div style={{ ...getMarbleStyle(e.color, 22), margin: '0 auto 5px', transition: 'none' }} />
                  <div className="emotion-name">{e.name}</div>
                </button>
              ))}
            </div>

            <div className="section-title" style={{ marginTop: 16 }}>날짜</div>
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="date-input"
              max={isClient ? new Date().toISOString().split('T')[0] : undefined}
            />

            <div className="section-title" style={{ marginTop: 14 }}>기록</div>
            <div className="textarea-wrap">
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                maxLength={500}
                placeholder="오늘의 감정을 자유롭게 써보세요..."
                className="memo-textarea"
              />
              <span className="char-count">{memo.length} / 500</span>
            </div>

            <div className="options-row">
              <div className="anon-toggle" onClick={() => setIsAnon(v => !v)}>
                <div className={`toggle-sw ${isAnon ? 'on' : ''}`}>
                  <div className="toggle-knob" />
                </div>
                <span>{isAnon ? '익명으로 저장 중' : '익명으로 저장'}</span>
              </div>
              {selectedEmotion && (
                <span style={{ fontSize: 11, color: EMOTIONS.find(e => e.id === selectedEmotion)?.color }}>
                  {EMOTIONS.find(e => e.id === selectedEmotion)?.name} ●
                </span>
              )}
            </div>

            <button
              className="submit-btn"
              onClick={addMarble}
              disabled={!canSubmit}
            >
              구슬에 담기 ✦
            </button>
          </div>
        )}

        {/* ── SHARE TAB ── */}
        {tab === 'share' && (
          <div className="tab-content">
            <div className="share-card">
              <h3 className="card-title">현재 병 공유하기</h3>
              {marbles.length === 0 ? (
                <div className="share-empty">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🫙</div>
                  <p>구슬이 없어요.</p>
                  <p style={{ fontSize: 11 }}>먼저 '기록' 탭에서 감정을 담아보세요!</p>
                </div>
              ) : (
                <>
                  <p className="share-desc">
                    구슬 데이터가 링크 안에 직접 담겨요.<br />
                    링크를 받은 사람은 브라우저에서 바로 병을 감상할 수 있어요.
                  </p>
                  <div className="share-url-box">
                    {shareLink ? (shareLink.length > 80 ? shareLink.slice(0, 80) + '…' : shareLink) : '링크 생성 중...'}
                  </div>
                  {copyStatus === 'done' && (
                    <div className="copy-notice success">✓ 클립보드에 복사됐어요!</div>
                  )}
                  {copyStatus === 'error' && (
                    <div className="copy-notice error">⚠ 자동 복사 실패 — 팝업에서 직접 복사해주세요</div>
                  )}
                  <button
                    className={`copy-btn ${copyStatus === 'done' ? 'done' : ''}`}
                    onClick={copyShareLink}
                    disabled={copyStatus === 'copying' || !shareLink}
                  >
                    {copyStatus === 'copying' ? '복사 중...' : copyStatus === 'done' ? '✓ 복사 완료!' : '🔗 공유 링크 복사하기'}
                  </button>

                  {/* Native share (mobile) */}
                  {isClient && typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      className="native-share-btn"
                      onClick={async () => {
                        try {
                          await navigator.share({ title: 'Emotion Marbles — 나의 구슬 병', url: shareLink });
                        } catch {}
                      }}
                    >
                      📤 공유하기 (카카오·문자·메모 등)
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="share-info-card">
              <h3 className="card-title">어떻게 작동하나요?</h3>
              <p className="share-desc">
                구슬 데이터를 URL에 직접 인코딩해요.<br />
                서버 없이도 공유 가능하며, 링크를 열면 공유된 병이 바로 보여요.<br />
                Vercel에 배포 후에는 짧고 예쁜 링크가 생성돼요.
              </p>
            </div>
          </div>
        )}

        {/* ── ARCHIVE TAB ── */}
        {tab === 'archive' && (
          <div className="tab-content">
            {archives.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 48, marginBottom: 12 }}>🫙</div>
                <p>아직 완성된 병이 없어요.</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>구슬 20개를 모으면 병이 완성돼요!</p>
              </div>
            ) : (
              <div className="archive-list">
                {archives.slice().reverse().map((jar, ri) => {
                  const i = archives.length - 1 - ri;
                  const d = new Date(jar.completedAt);
                  return (
                    <div key={i} className="archive-card">
                      <div className="archive-mini-marbles">
                        {jar.marbles.slice(0, 16).map((m, mi) => {
                          const e = EMOTIONS.find(x => x.id === m.emotion);
                          return (
                            <div key={mi} style={{ ...getMarbleStyle(e.color, 11), transition: 'none' }} />
                          );
                        })}
                      </div>
                      <div className="archive-info">
                        <div className="archive-title">
                          {d.getFullYear()}년 {d.getMonth() + 1}월 #{i + 1}
                        </div>
                        <div className="archive-sub">
                          {jar.marbles.length}개 · {d.toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notification */}
      {notif && (
        <div className="notif">
          {notif}
        </div>
      )}
    </>
  );
}

// ── Global Styles (injected as style tag) ─────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      html, body {
        font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
        background: #f0eeff;
        color: #2a2050;
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
        overflow-x: hidden;
      }

      body::before {
        content: '';
        position: fixed;
        inset: 0;
        background:
          radial-gradient(ellipse 70% 50% at 10% 10%, rgba(180,140,255,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 50% 60% at 90% 80%, rgba(100,160,255,0.13) 0%, transparent 60%);
        pointer-events: none;
        z-index: 0;
      }

      /* App container */
      .app-container {
        position: relative;
        z-index: 1;
        max-width: 480px;
        margin: 0 auto;
        padding: 0 0 80px;
        min-height: 100vh;
      }

      /* Header */
      .app-header {
        text-align: center;
        padding: 28px 20px 16px;
      }
      .app-header h1 {
        font-size: clamp(18px, 5vw, 22px);
        font-weight: 700;
        letter-spacing: 3px;
        color: #7c5cbf;
        text-transform: uppercase;
      }
      .app-header p {
        font-size: 12px;
        color: #a090c0;
        margin-top: 4px;
        letter-spacing: 0.5px;
      }

      /* Tab nav */
      .tab-nav {
        display: flex;
        justify-content: center;
        gap: 6px;
        padding: 0 16px 14px;
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .tab-nav::-webkit-scrollbar { display: none; }
      .tab-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        background: rgba(255,255,255,0.65);
        border: 1px solid rgba(160,140,220,0.25);
        border-radius: 16px;
        padding: 8px 12px 6px;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.25s ease;
        white-space: nowrap;
        flex-shrink: 0;
        min-width: 60px;
      }
      .tab-icon { font-size: 14px; line-height: 1; }
      .tab-label { font-size: 10px; color: #7060a0; letter-spacing: 0.3px; }
      .tab-btn.active {
        background: #7c5cbf;
        border-color: #7c5cbf;
        box-shadow: 0 4px 14px rgba(124,92,191,0.32);
      }
      .tab-btn.active .tab-label { color: #fff; }
      .tab-btn.active .tab-icon { filter: brightness(10); }

      /* Tab content */
      .tab-content {
        padding: 4px 16px 0;
      }

      /* Jar section */
      .jar-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 0 12px;
      }
      .jar-label {
        font-size: 11px;
        color: #a090c0;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 14px;
      }
      .jar-glass {
        width: 100%;
        max-width: 320px;
        background: rgba(180,160,255,0.07);
        border: 1.5px solid rgba(160,140,220,0.22);
        border-radius: 28px;
        padding: 20px 16px;
        min-height: 180px;
        box-shadow: inset 0 2px 12px rgba(180,160,255,0.08), 0 4px 24px rgba(124,92,191,0.07);
        position: relative;
        overflow: hidden;
      }
      .jar-glass::before {
        content: '';
        position: absolute;
        top: 12px; left: 14px;
        width: 6px; height: 60%;
        background: rgba(255,255,255,0.35);
        border-radius: 3px;
      }
      .marbles-wrap {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: center;
        align-content: flex-end;
        min-height: 140px;
      }
      .empty-hint {
        font-size: 12px;
        color: #c0b0e0;
        text-align: center;
        align-self: center;
        width: 100%;
        line-height: 1.7;
      }
      .capacity-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 12px;
        font-size: 11px;
        color: #a090c0;
      }
      .capacity-bar {
        width: 100px; height: 4px;
        background: rgba(160,140,220,0.18);
        border-radius: 2px; overflow: hidden;
      }
      .capacity-fill {
        height: 100%;
        background: linear-gradient(90deg, #a07de8, #4e8de8);
        border-radius: 2px;
        transition: width 0.5s ease;
      }

      /* Emotion grid */
      .section-title {
        font-size: 10px;
        color: #b0a0c8;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 10px;
        font-weight: 600;
      }
      .emotion-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin-bottom: 4px;
      }
      .emotion-btn {
        background: rgba(255,255,255,0.75);
        border: 1.5px solid rgba(160,140,220,0.2);
        border-radius: 14px;
        padding: 10px 4px 8px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s ease;
        font-family: inherit;
      }
      .emotion-btn:hover, .emotion-btn.selected {
        background: rgba(255,255,255,0.97);
        transform: translateY(-3px);
      }
      .emotion-name { font-size: 10px; color: #7060a0; margin-top: 4px; }

      /* Date input */
      .date-input {
        width: 100%;
        background: rgba(255,255,255,0.8);
        border: 1px solid rgba(160,140,220,0.25);
        border-radius: 12px;
        padding: 10px 14px;
        font-family: inherit;
        font-size: 14px;
        color: #2a2050;
        outline: none;
        appearance: none;
        -webkit-appearance: none;
        cursor: pointer;
        margin-bottom: 4px;
      }
      .date-input:focus { border-color: rgba(124,92,191,0.5); }

      /* Textarea */
      .textarea-wrap { position: relative; margin-bottom: 4px; }
      .memo-textarea {
        width: 100%;
        min-height: 96px;
        background: rgba(255,255,255,0.8);
        border: 1px solid rgba(160,140,220,0.25);
        border-radius: 16px;
        padding: 12px 14px 28px;
        font-family: inherit;
        font-size: 14px;
        color: #2a2050;
        resize: none;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
        line-height: 1.6;
      }
      .memo-textarea:focus {
        border-color: rgba(124,92,191,0.5);
        box-shadow: 0 4px 20px rgba(124,92,191,0.1);
      }
      .memo-textarea::placeholder { color: #c0b0d8; }
      .char-count {
        position: absolute; bottom: 9px; right: 12px;
        font-size: 11px; color: #c0b0d8;
      }

      /* Options row */
      .options-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 10px 2px 14px;
      }
      .anon-toggle {
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; color: #7060a0; cursor: pointer;
        user-select: none;
      }
      .toggle-sw {
        width: 36px; height: 20px;
        background: rgba(160,140,220,0.2);
        border-radius: 10px; position: relative;
        transition: background 0.2s;
        border: 1px solid rgba(160,140,220,0.25);
        flex-shrink: 0;
      }
      .toggle-sw.on { background: rgba(124,92,191,0.55); }
      .toggle-knob {
        position: absolute;
        width: 14px; height: 14px;
        background: #fff;
        border-radius: 50%;
        top: 2.5px; left: 3px;
        transition: left 0.2s;
        box-shadow: 0 1px 4px rgba(0,0,0,0.18);
      }
      .toggle-sw.on .toggle-knob { left: 19px; }

      /* Submit button */
      .submit-btn {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #7c5cbf, #4e8de8);
        border: none;
        border-radius: 16px;
        color: #fff;
        font-family: inherit;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 6px 20px rgba(124,92,191,0.32);
      }
      .submit-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 10px 28px rgba(124,92,191,0.42);
      }
      .submit-btn:disabled {
        opacity: 0.38;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }

      /* Share cards */
      .share-card, .share-info-card {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(160,140,220,0.2);
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 12px;
        box-shadow: 0 4px 20px rgba(124,92,191,0.06);
      }
      .share-info-card { background: rgba(240,238,255,0.55); }
      .card-title {
        font-size: 13px; font-weight: 600;
        color: #5a4090; margin-bottom: 10px; letter-spacing: 0.5px;
      }
      .share-desc {
        font-size: 12px; color: #9080b8;
        line-height: 1.8; margin-bottom: 12px;
      }
      .share-empty {
        text-align: center; padding: 16px 0 8px;
        font-size: 13px; color: #b0a0c8; line-height: 1.8;
      }
      .share-url-box {
        background: rgba(240,238,255,0.8);
        border: 1px solid rgba(160,140,220,0.22);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 11px; color: #7060a0;
        word-break: break-all;
        margin-bottom: 8px;
        font-family: monospace;
        line-height: 1.5;
      }
      .copy-notice {
        font-size: 11px; margin-bottom: 8px; padding: 6px 10px;
        border-radius: 8px; text-align: center;
      }
      .copy-notice.success { color: #1a9e6a; background: rgba(0,200,120,0.08); }
      .copy-notice.error { color: #c05030; background: rgba(255,80,0,0.07); }
      .copy-btn {
        width: 100%;
        padding: 11px;
        background: rgba(255,255,255,0.85);
        border: 1px solid rgba(160,140,220,0.28);
        border-radius: 12px;
        color: #7060a0;
        font-family: inherit; font-size: 13px;
        cursor: pointer; transition: all 0.2s;
        margin-bottom: 8px;
        font-weight: 500;
      }
      .copy-btn:hover:not(:disabled) { background: rgba(124,92,191,0.08); color: #7c5cbf; }
      .copy-btn.done { color: #1a9e6a; border-color: rgba(0,200,120,0.4); }
      .copy-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .native-share-btn {
        width: 100%;
        padding: 11px;
        background: linear-gradient(135deg, rgba(124,92,191,0.12), rgba(78,141,232,0.12));
        border: 1px solid rgba(124,92,191,0.25);
        border-radius: 12px;
        color: #6040a0;
        font-family: inherit; font-size: 13px;
        cursor: pointer; transition: all 0.2s;
        font-weight: 500;
      }
      .native-share-btn:hover { background: linear-gradient(135deg, rgba(124,92,191,0.2), rgba(78,141,232,0.2)); }

      /* Archive */
      .archive-list { display: flex; flex-direction: column; gap: 10px; }
      .archive-card {
        background: rgba(255,255,255,0.78);
        border: 1px solid rgba(160,140,220,0.2);
        border-radius: 16px;
        padding: 14px 16px;
        display: flex; align-items: center; gap: 14px;
        box-shadow: 0 2px 12px rgba(124,92,191,0.05);
      }
      .archive-mini-marbles {
        display: flex; flex-wrap: wrap; gap: 3px; width: 50px; flex-shrink: 0;
      }
      .archive-info { flex: 1; }
      .archive-title { font-size: 13px; font-weight: 600; color: #2a2050; margin-bottom: 3px; }
      .archive-sub { font-size: 11px; color: #a090c0; }

      /* Empty state */
      .empty-state {
        text-align: center; padding: 40px 20px;
        font-size: 13px; color: #a090c0; line-height: 1.8;
      }

      /* Notification */
      .notif {
        position: fixed;
        bottom: 24px; left: 50%;
        transform: translateX(-50%);
        background: rgba(255,255,255,0.97);
        border: 1px solid rgba(160,140,220,0.28);
        border-radius: 20px;
        padding: 10px 22px;
        font-size: 13px; color: #7c5cbf;
        box-shadow: 0 8px 32px rgba(124,92,191,0.18);
        white-space: nowrap; z-index: 9999;
        animation: notifPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
        max-width: calc(100vw - 40px);
        text-align: center;
      }
      @keyframes notifPop {
        from { transform: translateX(-50%) translateY(20px); opacity: 0; }
        to   { transform: translateX(-50%) translateY(0);    opacity: 1; }
      }
      @keyframes popIn {
        0%   { transform: scale(0); opacity: 0; }
        60%  { transform: scale(1.3); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }

      /* Mobile tweaks */
      @media (max-width: 380px) {
        .app-header h1 { font-size: 17px; letter-spacing: 2px; }
        .tab-btn { padding: 6px 10px 5px; min-width: 52px; }
        .tab-label { font-size: 9px; }
        .emotion-grid { gap: 6px; }
        .emotion-btn { padding: 8px 3px 6px; border-radius: 11px; }
        .emotion-name { font-size: 9px; }
        .tab-content { padding: 4px 12px 0; }
      }
    `}</style>
  );
}
