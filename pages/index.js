import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  collection, doc, setDoc, onSnapshot,
  addDoc, updateDoc, serverTimestamp, query, orderBy, getDocs, where
} from 'firebase/firestore';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

// ── Constants ──────────────────────────────────────────────────────────────
const EMOTIONS = [
  { id: 'happy',   name: '행복',   color: '#FFD700' },
  { id: 'excited', name: '설렘',   color: '#FF69B4' },
  { id: 'calm',    name: '평온',   color: '#00C87A' },
  { id: 'joy',     name: '즐거움', color: '#FF8C00' },
  { id: 'sad',     name: '슬픔',   color: '#1E90FF' },
  { id: 'angry',   name: '분노',   color: '#FF4500' },
  { id: 'anxious', name: '불안',   color: '#9370DB' },
  { id: 'tired',   name: '무기력', color: '#8899AA' },
];
const MAX_MARBLES = 20;
const SIZES = [30,26,28,24,32,26,28,30,24,28,26,30,28,24,32,28,26,30,24,28];

// ── Helpers ────────────────────────────────────────────────────────────────
function darken(hex, f = 0.52) {
  const r = Math.floor(parseInt(hex.slice(1,3),16)*f);
  const g = Math.floor(parseInt(hex.slice(3,5),16)*f);
  const b = Math.floor(parseInt(hex.slice(5,7),16)*f);
  return `rgb(${r},${g},${b})`;
}

function mStyle(color, size) {
  return {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: `radial-gradient(circle at 33% 30%,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0.45) 12%,${color}EE 30%,${color}BB 55%,${color}88 74%,${darken(color)} 100%)`,
    boxShadow: `inset -${size*.08}px -${size*.08}px ${size*.18}px rgba(0,0,0,0.2),inset ${size*.08}px ${size*.08}px ${size*.18}px rgba(255,255,255,0.65),0 0 ${size*.5}px ${color}55,0 ${size*.1}px ${size*.35}px rgba(0,0,0,0.18)`,
    cursor: 'pointer', transition: 'transform 0.18s ease', position: 'relative',
  };
}

function tsToMs(ts) {
  if (!ts) return Date.now();
  if (ts.toMillis) return ts.toMillis();
  return ts;
}

function timeAgo(ts) {
  const d = Date.now() - tsToMs(ts);
  const m = Math.floor(d/60000), h = Math.floor(d/3600000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(d/86400000)}일 전`;
}

function fmtDate(ts) {
  const d = new Date(tsToMs(ts));
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

function encodeJar(data) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(data)))); } catch { return null; }
}
function decodeJar(str) {
  try { return JSON.parse(decodeURIComponent(escape(atob(str)))); } catch { return null; }
}
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length:6}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

// ── Marble Component ───────────────────────────────────────────────────────
function Marble({ marble, index, isOwner }) {
  const [hovered, setHovered] = useState(false);
  const e = EMOTIONS.find(x => x.id === marble.emotion) || EMOTIONS[0];
  const size = SIZES[index % SIZES.length];
  const hidden = marble.isPrivate && !isOwner;

  return (
    <div
      style={{ position:'relative', flexShrink:0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(v => !v)}
    >
      <div style={{
        ...mStyle(e.color, size),
        transform: hovered ? 'scale(1.18) translateY(-2px)' : 'scale(1)',
        zIndex: hovered ? 10 : 1,
        filter: hidden ? 'blur(2px) brightness(0.65)' : 'none',
        opacity: hidden ? 0.7 : 1,
      }}>
        {marble.isPrivate && (
          <span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',
            justifyContent:'center',fontSize:size*0.36,pointerEvents:'none'}}>🔒</span>
        )}
      </div>
      {hovered && (
        <div style={{position:'absolute',bottom:'120%',left:'50%',transform:'translateX(-50%)',
          background:'rgba(255,252,255,0.98)',border:'1px solid rgba(160,140,220,0.3)',
          borderRadius:14,padding:'11px 13px',width:196,fontSize:12,color:'#2a2050',
          zIndex:200,boxShadow:'0 8px 32px rgba(124,92,191,0.2)',lineHeight:1.55,pointerEvents:'none'}}>
          <div style={{fontSize:10,color:'#9378c8',marginBottom:4,fontWeight:600}}>
            {e.name} · {fmtDate(marble.customDate || marble.ts)}
          </div>
          {hidden
            ? <div style={{color:'#b0a0c8',fontStyle:'italic'}}>🔒 비공개 구슬이에요</div>
            : <div style={{wordBreak:'break-word',whiteSpace:'pre-wrap',maxHeight:88,overflow:'hidden'}}>
                {marble.text || '(내용 없음)'}
              </div>
          }
          <div style={{fontSize:10,color:'#b0a0d0',marginTop:5}}>
            {marble.authorName || '익명'} · {timeAgo(marble.ts)}
          </div>
          <div style={{position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',
            borderLeft:'6px solid transparent',borderRight:'6px solid transparent',
            borderTop:'6px solid rgba(160,140,220,0.3)',width:0,height:0}} />
        </div>
      )}
    </div>
  );
}

// ── Mini Jar Preview ───────────────────────────────────────────────────────
function MiniJar({ marbles }) {
  return (
    <div style={{background:'rgba(180,160,255,0.07)',border:'1px solid rgba(160,140,220,0.2)',
      borderRadius:18,padding:12,marginBottom:12}}>
      <div style={{fontSize:10,color:'#b0a0d0',letterSpacing:1.5,textTransform:'uppercase',
        marginBottom:7,textAlign:'center'}}>현재 병 미리보기</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:4,justifyContent:'center',
        alignContent:'flex-end',minHeight:52,padding:'2px 6px'}}>
        {marbles.length === 0
          ? <p style={{fontSize:12,color:'#c0b0e0',alignSelf:'center',textAlign:'center',width:'100%'}}>기록하면 여기 구슬이 담겨요 ✦</p>
          : marbles.map((m,i) => {
              const ee = EMOTIONS.find(x=>x.id===m.emotion)||EMOTIONS[0];
              const s = Math.round(SIZES[i%SIZES.length]*0.7);
              return <div key={m.id||i} style={{...mStyle(ee.color,s),transition:'none'}} />;
            })
        }
      </div>
      <div style={{textAlign:'center',marginTop:5,fontSize:11,color:'#b0a0d0'}}>
        {marbles.length} / {MAX_MARBLES}개
      </div>
    </div>
  );
}

// ── Public Shared View ─────────────────────────────────────────────────────
function SharedView({ data, onGoMain }) {
  return (
    <div style={{minHeight:'100vh',background:'#f0eeff',display:'flex',flexDirection:'column',
      alignItems:'center',padding:'40px 20px 60px'}}>
      <div style={{textAlign:'center',marginBottom:22}}>
        <div style={{fontSize:32,marginBottom:8}}>🫙</div>
        <h2 style={{color:'#7c5cbf',fontSize:20,fontWeight:700,marginBottom:5}}>공유된 감정 구슬 병</h2>
        <p style={{color:'#a090c0',fontSize:12}}>{data.marbles?.length}개의 구슬</p>
        <p style={{color:'#c0b0d8',fontSize:11,marginTop:3}}>구슬을 터치하면 감정이 보여요</p>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',maxWidth:340,
        background:'rgba(180,160,255,0.08)',border:'1px solid rgba(160,140,220,0.2)',
        borderRadius:24,padding:'20px 14px',marginBottom:28,alignContent:'flex-end',minHeight:100}}>
        {(data.marbles||[]).map((m,i) => <Marble key={m.id||i} marble={m} index={i} isOwner={false} />)}
      </div>
      <button onClick={onGoMain} style={{padding:'13px 32px',
        background:'linear-gradient(135deg,#7c5cbf,#4e8de8)',border:'none',borderRadius:20,
        color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',
        boxShadow:'0 6px 24px rgba(124,92,191,0.35)',fontFamily:'inherit'}}>
        ✦ 나도 구슬 만들기
      </button>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();

  const [uid, setUid]                     = useState(null);
  const [nickname, setNickname]           = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [showNickModal, setShowNickModal] = useState(false);

  const [myMarbles, setMyMarbles]   = useState([]);
  const [myArchives, setMyArchives] = useState([]);

  const [sharedJarId, setSharedJarId]   = useState(null);
  const [sharedJar, setSharedJar]       = useState(null);
  const [sharedMarbles, setSharedMarbles] = useState([]);
  const [inviteInput, setInviteInput]   = useState('');
  const [jarNameInput, setJarNameInput] = useState('');
  const [joinLoading, setJoinLoading]   = useState(false);

  const [tab, setTab]                       = useState('jar');
  const [selectedEmotion, setSelectedEmotion] = useState(null);
  const [memo, setMemo]                     = useState('');
  const [isAnon, setIsAnon]                 = useState(false);
  const [isPrivate, setIsPrivate]           = useState(false);
  const [customDate, setCustomDate]         = useState('');
  const [targetJar, setTargetJar]           = useState('my');
  const [notif, setNotif]                   = useState('');
  const [copyStatus, setCopyStatus]         = useState('idle');
  const [isClient, setIsClient]             = useState(false);
  const [publicShared, setPublicShared]     = useState(null);

  const notifTimer = useRef(null);
  const unsubRef   = useRef(null);

  // ── Init ──
  useEffect(() => {
    setIsClient(true);
    setCustomDate(new Date().toISOString().split('T')[0]);
    try {
      const m = localStorage.getItem('em_marbles');
      const a = localStorage.getItem('em_archives');
      const n = localStorage.getItem('em_nickname');
      const j = localStorage.getItem('em_sharedJarId');
      if (m) setMyMarbles(JSON.parse(m));
      if (a) setMyArchives(JSON.parse(a));
      if (n) setNickname(n);
      if (j) setSharedJarId(j);
    } catch {}

    signInAnonymously(auth).catch(() => {});
    const unsub = onAuthStateChanged(auth, user => {
      if (user) {
        setUid(user.uid);
        if (!localStorage.getItem('em_nickname')) setShowNickModal(true);
      }
    });
    return () => unsub();
  }, []);

  // ── Public URL detection ──
  useEffect(() => {
    if (!router.isReady) return;
    const { jar } = router.query;
    if (jar) {
      const d = decodeJar(jar);
      if (d?.marbles) setPublicShared(d);
    }
  }, [router.isReady, router.query]);

  // ── Listen to shared jar ──
  useEffect(() => {
    if (!sharedJarId) return;
    if (unsubRef.current) unsubRef.current();

    const jarRef = doc(db, 'sharedJars', sharedJarId);
    const u1 = onSnapshot(jarRef, snap => {
      if (snap.exists()) setSharedJar(snap.data());
    });

    const mRef = query(collection(db, 'sharedJars', sharedJarId, 'marbles'), orderBy('ts', 'asc'));
    const u2 = onSnapshot(mRef, snap => {
      setSharedMarbles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    unsubRef.current = () => { u1(); u2(); };
    return () => { u1(); u2(); };
  }, [sharedJarId]);

  function persist(m, a) {
    try {
      localStorage.setItem('em_marbles', JSON.stringify(m));
      localStorage.setItem('em_archives', JSON.stringify(a));
    } catch {}
  }

  function showNotif(msg) {
    setNotif(msg);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(''), 3200);
  }

  function saveNickname() {
    const n = nicknameInput.trim() || '익명';
    setNickname(n);
    localStorage.setItem('em_nickname', n);
    setShowNickModal(false);
  }

  // ── Add marble ──
  async function addMarble() {
    if (!memo.trim() || !selectedEmotion) return;
    const e = EMOTIONS.find(x => x.id === selectedEmotion);

    if (targetJar === 'shared' && sharedJarId) {
      try {
        await addDoc(collection(db, 'sharedJars', sharedJarId, 'marbles'), {
          emotion: selectedEmotion,
          text: isAnon ? '' : memo.trim(),
          anon: isAnon,
          isPrivate,
          authorUid: uid || 'anon',
          authorName: isAnon ? '익명' : (nickname || '익명'),
          ts: serverTimestamp(),
          customDate: customDate ? new Date(customDate).getTime() : Date.now(),
        });
        showNotif(`✨ ${e.name} 구슬이 공유 병에 담겼어요`);
      } catch {
        showNotif('⚠️ 저장 실패. 인터넷 연결을 확인해주세요.');
        return;
      }
    } else {
      const marble = {
        id: Date.now(), emotion: selectedEmotion, text: memo.trim(),
        anon: isAnon, isPrivate, authorName: isAnon ? '익명' : (nickname || '나'),
        ts: Date.now(), customDate: customDate ? new Date(customDate).getTime() : Date.now(),
      };
      let newM = [...myMarbles, marble];
      let newA = myArchives;
      if (newM.length >= MAX_MARBLES) {
        newA = [...myArchives, { marbles: newM, completedAt: Date.now() }];
        newM = [];
        showNotif('🎉 병이 가득 찼어요! 보관함으로 이동했어요');
      } else {
        showNotif(`✨ ${e.name} 구슬이 병에 담겼어요`);
      }
      setMyMarbles(newM); setMyArchives(newA); persist(newM, newA);
    }

    setMemo(''); setSelectedEmotion(null); setIsPrivate(false);
    setCustomDate(new Date().toISOString().split('T')[0]);
    setTab(targetJar === 'shared' ? 'shared' : 'jar');
  }

  // ── Create shared jar ──
  async function createSharedJar() {
    if (!uid) { showNotif('잠시 후 다시 시도해주세요'); return; }
    const name = jarNameInput.trim() || '우리의 구슬 병';
    const code = genCode();
    try {
      const ref = doc(collection(db, 'sharedJars'));
      await setDoc(ref, {
        name, inviteCode: code, createdBy: uid,
        members: [{ uid, name: nickname || '나' }],
        createdAt: serverTimestamp(),
      });
      setSharedJarId(ref.id);
      localStorage.setItem('em_sharedJarId', ref.id);
      setJarNameInput('');
      showNotif(`🎉 "${name}" 이 만들어졌어요! 초대 코드: ${code}`);
    } catch { showNotif('⚠️ 생성 실패. 잠시 후 다시 시도해주세요.'); }
  }

  // ── Join shared jar ──
  async function joinSharedJar() {
    const code = inviteInput.trim().toUpperCase();
    if (!code || !uid) return;
    setJoinLoading(true);
    try {
      const q = query(collection(db, 'sharedJars'), where('inviteCode', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) { showNotif('❌ 코드를 찾을 수 없어요.'); setJoinLoading(false); return; }
      const jarDoc = snap.docs[0];
      const data = jarDoc.data();
      const already = (data.members||[]).some(m => m.uid === uid);
      if (!already) {
        await updateDoc(jarDoc.ref, { members: [...(data.members||[]), { uid, name: nickname||'익명' }] });
      }
      setSharedJarId(jarDoc.id);
      localStorage.setItem('em_sharedJarId', jarDoc.id);
      setInviteInput('');
      showNotif(`✅ "${data.name}" 에 참여했어요!`);
    } catch { showNotif('⚠️ 참여 실패. 잠시 후 다시 시도해주세요.'); }
    setJoinLoading(false);
  }

  // ── Leave shared jar ──
  function leaveSharedJar() {
    if (!window.confirm('공유 병에서 나가시겠어요?')) return;
    if (unsubRef.current) unsubRef.current();
    setSharedJarId(null); setSharedJar(null); setSharedMarbles([]);
    localStorage.removeItem('em_sharedJarId');
    showNotif('공유 병에서 나왔어요');
  }

  // ── Copy public link ──
  async function copyLink(which = 'my') {
    if (!isClient) return;
    const src = which === 'shared'
      ? sharedMarbles.filter(m => !m.isPrivate)
      : myMarbles.filter(m => !m.isPrivate);
    if (src.length === 0) { showNotif('공개 구슬이 없어요'); return; }
    const payload = encodeJar({ marbles: src, createdAt: Date.now() });
    if (!payload) return;
    const link = `${window.location.origin}${window.location.pathname}?jar=${payload}`;
    setCopyStatus('copying');
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(link); ok = true; } catch {}
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = link; ta.style.cssText = 'position:fixed;opacity:0;top:-9999px';
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy'); document.body.removeChild(ta);
      } catch {}
    }
    if (!ok) { window.prompt('아래 링크를 복사하세요:', link); setCopyStatus('idle'); return; }
    setCopyStatus('done');
    setTimeout(() => setCopyStatus('idle'), 2500);
  }

  // ── Public shared view ──
  if (publicShared) {
    return (
      <>
        <Head><title>Emotion Marbles — 공유된 병</title>
          <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" /></Head>
        <GlobalStyles />
        <SharedView data={publicShared} onGoMain={() => {
          setPublicShared(null);
          router.replace('/', undefined, { shallow: true });
        }} />
      </>
    );
  }

  const canSubmit = !!selectedEmotion && memo.trim().length > 0;

  return (
    <>
      <Head>
        <title>Emotion Marbles</title>
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
      </Head>
      <GlobalStyles />

      {/* Nickname modal */}
      {showNickModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(30,20,60,0.55)',zIndex:9999,
          display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'#fff',borderRadius:24,padding:28,maxWidth:320,width:'100%',
            boxShadow:'0 20px 60px rgba(124,92,191,0.25)'}}>
            <h3 style={{color:'#7c5cbf',fontSize:16,fontWeight:700,marginBottom:6,textAlign:'center'}}>반가워요! 🫙</h3>
            <p style={{color:'#9080b8',fontSize:13,textAlign:'center',marginBottom:16,lineHeight:1.6}}>
              공유 병에서 사용할 닉네임을 정해주세요
            </p>
            <input value={nicknameInput} onChange={e => setNicknameInput(e.target.value)}
              onKeyDown={e => e.key==='Enter'&&saveNickname()}
              placeholder="닉네임 (예: 엄마, 민준이)" maxLength={10}
              style={{width:'100%',padding:'11px 14px',borderRadius:12,
                border:'1.5px solid rgba(160,140,220,0.35)',fontFamily:'inherit',
                fontSize:14,color:'#2a2050',outline:'none',marginBottom:12}} />
            <button onClick={saveNickname} style={{width:'100%',padding:12,
              background:'linear-gradient(135deg,#7c5cbf,#4e8de8)',border:'none',borderRadius:14,
              color:'#fff',fontFamily:'inherit',fontSize:14,fontWeight:600,cursor:'pointer'}}>
              시작하기
            </button>
          </div>
        </div>
      )}

      <div className="app-container">
        <header className="app-header">
          <h1>Emotion Marbles</h1>
          <p>당신의 감정을 구슬에 담아 보관하세요</p>
        </header>

        <nav className="tab-nav">
          {[['jar','🫙','나의 병'],['shared','👥','공유 병'],['add','✦','기록'],['link','↗','공유'],['archive','◎','보관함']].map(([id,icon,label]) => (
            <button key={id} className={`tab-btn ${tab===id?'active':''}`} onClick={() => setTab(id)}>
              <span className="tab-icon">{icon}</span>
              <span className="tab-label">{label}</span>
            </button>
          ))}
        </nav>

        {/* ── MY JAR ── */}
        {tab === 'jar' && (
          <div className="tab-content">
            <div className="jar-section">
              <div className="jar-label">
                {myMarbles.length > 0
                  ? `${new Date(tsToMs(myMarbles[0].customDate||myMarbles[0].ts)).getFullYear()}년 ${new Date(tsToMs(myMarbles[0].customDate||myMarbles[0].ts)).getMonth()+1}월의 기억`
                  : '나의 병'}
              </div>
              <div className="jar-glass">
                <div className="marbles-wrap">
                  {myMarbles.length === 0
                    ? <p className="empty-hint">아직 구슬이 없어요<br/><span style={{fontSize:11}}>'기록' 탭에서 담아보세요</span></p>
                    : myMarbles.map((m,i) => <Marble key={m.id||i} marble={m} index={i} isOwner={true} />)
                  }
                </div>
              </div>
              <div className="capacity-row">
                <span>{myMarbles.length} / {MAX_MARBLES}</span>
                <div className="capacity-bar"><div className="capacity-fill" style={{width:`${(myMarbles.length/MAX_MARBLES)*100}%`}} /></div>
              </div>
            </div>
          </div>
        )}

        {/* ── SHARED JAR ── */}
        {tab === 'shared' && (
          <div className="tab-content">
            {!sharedJarId ? (
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <div className="share-card">
                  <h3 className="card-title">🫙 새 공유 병 만들기</h3>
                  <p className="share-desc">가족, 친구, 연인과 함께 구슬을 담는 병을 만들어요.</p>
                  <input value={jarNameInput} onChange={e => setJarNameInput(e.target.value)}
                    placeholder="병 이름 (예: 우리 가족 🏡)" maxLength={20} className="text-input" />
                  <button className="submit-btn" onClick={createSharedJar} style={{marginTop:10}}>병 만들기</button>
                </div>
                <div className="share-card">
                  <h3 className="card-title">🔑 초대 코드로 참여하기</h3>
                  <p className="share-desc">함께할 사람에게 초대 코드를 받아 입력하세요.</p>
                  <input value={inviteInput} onChange={e => setInviteInput(e.target.value.toUpperCase())}
                    placeholder="초대 코드 (예: AB12CD)" maxLength={6} className="text-input"
                    style={{letterSpacing:4,textAlign:'center',fontWeight:700,fontSize:18}} />
                  <button className="submit-btn" onClick={joinSharedJar}
                    disabled={joinLoading} style={{marginTop:10}}>
                    {joinLoading ? '참여 중...' : '참여하기'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Jar info card */}
                <div className="share-card" style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                    <div>
                      <h3 className="card-title" style={{marginBottom:3}}>{sharedJar?.name || '공유 병'}</h3>
                      <div style={{fontSize:12,color:'#9080b8'}}>참여자 {sharedJar?.members?.length || 1}명</div>
                    </div>
                    <button onClick={leaveSharedJar} style={{background:'none',
                      border:'1px solid rgba(200,100,80,0.3)',borderRadius:8,padding:'4px 10px',
                      fontSize:11,color:'#c07060',cursor:'pointer',fontFamily:'inherit'}}>나가기</button>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:12}}>
                    {(sharedJar?.members||[]).map((m,i) => (
                      <span key={i} style={{fontSize:11,background:'rgba(124,92,191,0.1)',
                        color:'#7c5cbf',padding:'3px 10px',borderRadius:20}}>{m.name}</span>
                    ))}
                  </div>
                  <div style={{background:'rgba(124,92,191,0.06)',borderRadius:12,
                    padding:'10px 14px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:'#a090c0',marginBottom:4,letterSpacing:1}}>
                      초대 코드 — 친구에게 공유하세요
                    </div>
                    <div style={{fontSize:24,fontWeight:700,color:'#7c5cbf',letterSpacing:5}}>
                      {sharedJar?.inviteCode || '------'}
                    </div>
                  </div>
                </div>

                {/* Shared marbles */}
                <div className="jar-label" style={{textAlign:'center',marginBottom:10}}>함께 담은 구슬</div>
                <div className="jar-glass">
                  <div className="marbles-wrap">
                    {sharedMarbles.length === 0
                      ? <p className="empty-hint">아직 구슬이 없어요<br/><span style={{fontSize:11}}>기록 탭에서 공유 병을 선택해 담아보세요</span></p>
                      : sharedMarbles.map((m,i) =>
                          <Marble key={m.id||i} marble={m} index={i} isOwner={m.authorUid===uid} />
                        )
                    }
                  </div>
                </div>
                <div className="capacity-row" style={{justifyContent:'center',marginTop:10}}>
                  <span>{sharedMarbles.length}개의 구슬이 담겨 있어요</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ADD ── */}
        {tab === 'add' && (
          <div className="tab-content">
            <MiniJar marbles={targetJar==='shared' ? sharedMarbles : myMarbles} />

            {sharedJarId && (
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                {[['my','🫙 나의 병'],['shared','👥 공유 병']].map(([v,label]) => (
                  <button key={v} onClick={() => setTargetJar(v)} style={{
                    flex:1,padding:'9px 0',borderRadius:12,fontFamily:'inherit',
                    fontSize:13,fontWeight:500,cursor:'pointer',
                    background: targetJar===v ? '#7c5cbf' : 'rgba(255,255,255,0.75)',
                    border: `1px solid ${targetJar===v ? '#7c5cbf' : 'rgba(160,140,220,0.25)'}`,
                    color: targetJar===v ? '#fff' : '#7060a0',
                  }}>{label}</button>
                ))}
              </div>
            )}

            <div className="section-title">감정 선택</div>
            <div className="emotion-grid">
              {EMOTIONS.map(e => (
                <button key={e.id}
                  className={`emotion-btn ${selectedEmotion===e.id?'selected':''}`}
                  style={selectedEmotion===e.id ? {borderColor:e.color+'AA',boxShadow:`0 6px 20px ${e.color}30`} : {}}
                  onClick={() => setSelectedEmotion(e.id)}>
                  <div style={{...mStyle(e.color,22),margin:'0 auto 5px',transition:'none'}} />
                  <div className="emotion-name">{e.name}</div>
                </button>
              ))}
            </div>

            <div className="section-title" style={{marginTop:13}}>날짜</div>
            <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
              className="date-input" max={isClient ? new Date().toISOString().split('T')[0] : undefined} />

            <div className="section-title" style={{marginTop:11}}>기록</div>
            <div className="textarea-wrap">
              <textarea value={memo} onChange={e => setMemo(e.target.value)} maxLength={500}
                placeholder="오늘의 감정을 자유롭게 써보세요..." className="memo-textarea" />
              <span className="char-count">{memo.length} / 500</span>
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:9,margin:'10px 2px 13px'}}>
              <div className="anon-toggle" onClick={() => setIsAnon(v => !v)}>
                <div className={`toggle-sw ${isAnon?'on':''}`}><div className="toggle-knob"/></div>
                <span>익명으로 저장</span>
              </div>
              <div className="anon-toggle" onClick={() => setIsPrivate(v => !v)}>
                <div className={`toggle-sw ${isPrivate?'on':''}`}
                  style={isPrivate?{background:'rgba(255,140,0,0.5)'}:{}}><div className="toggle-knob"/></div>
                <span>🔒 구슬 숨기기 {isPrivate ? '— 나만 내용을 볼 수 있어요' : ''}</span>
              </div>
            </div>

            <button className="submit-btn" onClick={addMarble} disabled={!canSubmit}>
              구슬에 담기 ✦
            </button>
          </div>
        )}

        {/* ── LINK SHARE ── */}
        {tab === 'link' && (
          <div className="tab-content">
            <div className="share-card">
              <h3 className="card-title">나의 병 링크로 공유</h3>
              <p className="share-desc">🔒 숨긴 구슬은 링크에 포함되지 않아요.</p>
              {copyStatus==='done' && <div className="copy-notice success">✓ 복사됐어요!</div>}
              <button className={`copy-btn ${copyStatus==='done'?'done':''}`}
                onClick={() => copyLink('my')} disabled={copyStatus==='copying'}>
                {copyStatus==='copying'?'복사 중...':copyStatus==='done'?'✓ 복사 완료!':'🔗 나의 병 링크 복사'}
              </button>
              {sharedJarId && (
                <button className="copy-btn" onClick={() => copyLink('shared')} style={{marginTop:0}}>
                  🔗 공유 병 링크 복사 (공개 구슬만)
                </button>
              )}
              {isClient && typeof navigator !== 'undefined' && navigator.share && (
                <button className="native-share-btn" onClick={async () => {
                  if (!isClient) return;
                  const src = myMarbles.filter(m => !m.isPrivate);
                  if (!src.length) { showNotif('공개 구슬이 없어요'); return; }
                  const p = encodeJar({ marbles: src, createdAt: Date.now() });
                  const link = `${window.location.origin}${window.location.pathname}?jar=${p}`;
                  try { await navigator.share({ title:'Emotion Marbles', url: link }); } catch {}
                }}>📤 카카오·문자로 바로 공유</button>
              )}
            </div>
            <div className="share-info-card">
              <h3 className="card-title">공유 병 vs 링크 공유</h3>
              <p className="share-desc" style={{marginBottom:0}}>
                <strong style={{color:'#5a4090'}}>👥 공유 병</strong> — 실시간. 서로 구슬을 담고 바로 확인.<br/>
                <strong style={{color:'#5a4090'}}>🔗 링크 공유</strong> — 현재 시점 스냅샷. 읽기 전용.
              </p>
            </div>
          </div>
        )}

        {/* ── ARCHIVE ── */}
        {tab === 'archive' && (
          <div className="tab-content">
            {myArchives.length === 0 ? (
              <div className="empty-state">
                <div style={{fontSize:48,marginBottom:12}}>🫙</div>
                <p>아직 완성된 병이 없어요.</p>
                <p style={{fontSize:11,marginTop:4}}>구슬 20개를 모으면 병이 완성돼요!</p>
              </div>
            ) : (
              <div className="archive-list">
                {myArchives.slice().reverse().map((jar,ri) => {
                  const i = myArchives.length-1-ri;
                  const d = new Date(jar.completedAt);
                  return (
                    <div key={i} className="archive-card">
                      <div className="archive-mini-marbles">
                        {jar.marbles.slice(0,16).map((m,mi) => {
                          const ee = EMOTIONS.find(x=>x.id===m.emotion)||EMOTIONS[0];
                          return <div key={mi} style={{...mStyle(ee.color,11),transition:'none'}} />;
                        })}
                      </div>
                      <div className="archive-info">
                        <div className="archive-title">{d.getFullYear()}년 {d.getMonth()+1}월 #{i+1}</div>
                        <div className="archive-sub">{jar.marbles.length}개 · {d.toLocaleDateString('ko-KR')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {notif && <div className="notif">{notif}</div>}
    </>
  );
}

// ── Global Styles ──────────────────────────────────────────────────────────
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      html,body{font-family:'Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif;
        background:#f0eeff;color:#2a2050;min-height:100vh;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
      body::before{content:'';position:fixed;inset:0;
        background:radial-gradient(ellipse 70% 50% at 10% 10%,rgba(180,140,255,0.18) 0%,transparent 60%),
          radial-gradient(ellipse 50% 60% at 90% 80%,rgba(100,160,255,0.13) 0%,transparent 60%);
        pointer-events:none;z-index:0;}
      .app-container{position:relative;z-index:1;max-width:480px;margin:0 auto;padding:0 0 80px;min-height:100vh;}
      .app-header{text-align:center;padding:24px 20px 12px;}
      .app-header h1{font-size:clamp(16px,5vw,21px);font-weight:700;letter-spacing:3px;color:#7c5cbf;text-transform:uppercase;}
      .app-header p{font-size:12px;color:#a090c0;margin-top:4px;}
      .tab-nav{display:flex;justify-content:center;gap:5px;padding:0 10px 11px;
        overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;flex-wrap:nowrap;}
      .tab-nav::-webkit-scrollbar{display:none;}
      .tab-btn{display:flex;flex-direction:column;align-items:center;gap:2px;
        background:rgba(255,255,255,0.65);border:1px solid rgba(160,140,220,0.25);border-radius:13px;
        padding:7px 9px 5px;font-family:inherit;cursor:pointer;transition:all .25s;
        white-space:nowrap;flex-shrink:0;min-width:48px;}
      .tab-icon{font-size:13px;line-height:1;}
      .tab-label{font-size:10px;color:#7060a0;}
      .tab-btn.active{background:#7c5cbf;border-color:#7c5cbf;box-shadow:0 4px 14px rgba(124,92,191,.32);}
      .tab-btn.active .tab-label{color:#fff;}
      .tab-content{padding:4px 14px 0;}
      .jar-section{display:flex;flex-direction:column;align-items:center;padding:0 0 10px;}
      .jar-label{font-size:11px;color:#a090c0;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;}
      .jar-glass{width:100%;max-width:340px;background:rgba(180,160,255,.07);
        border:1.5px solid rgba(160,140,220,.22);border-radius:26px;padding:16px 13px;
        min-height:150px;position:relative;overflow:hidden;}
      .jar-glass::before{content:'';position:absolute;top:12px;left:13px;width:5px;height:58%;
        background:rgba(255,255,255,.35);border-radius:3px;}
      .marbles-wrap{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-content:flex-end;min-height:110px;}
      .empty-hint{font-size:12px;color:#c0b0e0;text-align:center;align-self:center;width:100%;line-height:1.7;}
      .capacity-row{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:11px;color:#a090c0;}
      .capacity-bar{width:90px;height:4px;background:rgba(160,140,220,.18);border-radius:2px;overflow:hidden;}
      .capacity-fill{height:100%;background:linear-gradient(90deg,#a07de8,#4e8de8);border-radius:2px;transition:width .5s ease;}
      .section-title{font-size:10px;color:#b0a0c8;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;font-weight:600;}
      .emotion-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:2px;}
      .emotion-btn{background:rgba(255,255,255,.75);border:1.5px solid rgba(160,140,220,.2);
        border-radius:12px;padding:8px 3px 7px;cursor:pointer;text-align:center;transition:all .2s;font-family:inherit;}
      .emotion-btn:hover,.emotion-btn.selected{background:rgba(255,255,255,.97);transform:translateY(-3px);}
      .emotion-name{font-size:10px;color:#7060a0;margin-top:4px;}
      .date-input{width:100%;background:rgba(255,255,255,.8);border:1px solid rgba(160,140,220,.25);
        border-radius:12px;padding:10px 14px;font-family:inherit;font-size:14px;color:#2a2050;
        outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;margin-bottom:2px;}
      .text-input{width:100%;background:rgba(255,255,255,.8);border:1px solid rgba(160,140,220,.25);
        border-radius:12px;padding:11px 14px;font-family:inherit;font-size:14px;color:#2a2050;outline:none;}
      .textarea-wrap{position:relative;margin-bottom:2px;}
      .memo-textarea{width:100%;min-height:88px;background:rgba(255,255,255,.8);
        border:1px solid rgba(160,140,220,.25);border-radius:15px;padding:11px 13px 26px;
        font-family:inherit;font-size:14px;color:#2a2050;resize:none;outline:none;
        transition:border-color .2s,box-shadow .2s;line-height:1.6;}
      .memo-textarea:focus{border-color:rgba(124,92,191,.5);box-shadow:0 4px 20px rgba(124,92,191,.1);}
      .memo-textarea::placeholder{color:#c0b0d8;}
      .char-count{position:absolute;bottom:8px;right:12px;font-size:11px;color:#c0b0d8;}
      .anon-toggle{display:flex;align-items:center;gap:8px;font-size:12px;color:#7060a0;cursor:pointer;user-select:none;}
      .toggle-sw{width:36px;height:20px;background:rgba(160,140,220,.2);border-radius:10px;position:relative;
        transition:background .2s;border:1px solid rgba(160,140,220,.25);flex-shrink:0;}
      .toggle-sw.on{background:rgba(124,92,191,.55);}
      .toggle-knob{position:absolute;width:14px;height:14px;background:#fff;border-radius:50%;
        top:2.5px;left:3px;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.18);}
      .toggle-sw.on .toggle-knob{left:19px;}
      .submit-btn{width:100%;padding:13px;background:linear-gradient(135deg,#7c5cbf,#4e8de8);
        border:none;border-radius:15px;color:#fff;font-family:inherit;font-size:14px;font-weight:600;
        cursor:pointer;transition:all .2s;box-shadow:0 6px 20px rgba(124,92,191,.32);}
      .submit-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 10px 28px rgba(124,92,191,.42);}
      .submit-btn:disabled{opacity:.38;cursor:not-allowed;transform:none;box-shadow:none;}
      .share-card,.share-info-card{background:rgba(255,255,255,.78);border:1px solid rgba(160,140,220,.2);
        border-radius:18px;padding:17px;margin-bottom:11px;box-shadow:0 4px 20px rgba(124,92,191,.06);}
      .share-info-card{background:rgba(240,238,255,.55);}
      .card-title{font-size:13px;font-weight:700;color:#5a4090;margin-bottom:7px;}
      .share-desc{font-size:12px;color:#9080b8;line-height:1.8;margin-bottom:11px;}
      .copy-notice{font-size:11px;margin-bottom:8px;padding:6px 10px;border-radius:8px;text-align:center;}
      .copy-notice.success{color:#1a9e6a;background:rgba(0,200,120,.08);}
      .copy-btn{width:100%;padding:10px;background:rgba(255,255,255,.85);
        border:1px solid rgba(160,140,220,.28);border-radius:11px;color:#7060a0;
        font-family:inherit;font-size:13px;cursor:pointer;transition:all .2s;margin-bottom:8px;font-weight:500;}
      .copy-btn:hover:not(:disabled){background:rgba(124,92,191,.08);color:#7c5cbf;}
      .copy-btn.done{color:#1a9e6a;border-color:rgba(0,200,120,.4);}
      .copy-btn:disabled{opacity:.5;cursor:not-allowed;}
      .native-share-btn{width:100%;padding:10px;
        background:linear-gradient(135deg,rgba(124,92,191,.12),rgba(78,141,232,.12));
        border:1px solid rgba(124,92,191,.25);border-radius:11px;color:#6040a0;
        font-family:inherit;font-size:13px;cursor:pointer;font-weight:500;}
      .archive-list{display:flex;flex-direction:column;gap:9px;}
      .archive-card{background:rgba(255,255,255,.78);border:1px solid rgba(160,140,220,.2);
        border-radius:15px;padding:13px 15px;display:flex;align-items:center;gap:13px;}
      .archive-mini-marbles{display:flex;flex-wrap:wrap;gap:3px;width:48px;flex-shrink:0;}
      .archive-info{flex:1;}
      .archive-title{font-size:13px;font-weight:600;color:#2a2050;margin-bottom:3px;}
      .archive-sub{font-size:11px;color:#a090c0;}
      .empty-state{text-align:center;padding:40px 20px;font-size:13px;color:#a090c0;line-height:1.8;}
      .notif{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:rgba(255,255,255,.97);border:1px solid rgba(160,140,220,.28);border-radius:20px;
        padding:10px 22px;font-size:13px;color:#7c5cbf;box-shadow:0 8px 32px rgba(124,92,191,.18);
        white-space:nowrap;z-index:9999;animation:notifPop .4s cubic-bezier(.34,1.56,.64,1) forwards;
        max-width:calc(100vw - 40px);text-align:center;}
      @keyframes notifPop{
        from{transform:translateX(-50%) translateY(20px);opacity:0;}
        to{transform:translateX(-50%) translateY(0);opacity:1;}}
      @media(max-width:380px){
        .app-header h1{font-size:15px;letter-spacing:2px;}
        .tab-btn{padding:6px 7px 4px;min-width:42px;}
        .tab-label{font-size:9px;}
        .emotion-grid{gap:5px;}
        .emotion-btn{padding:7px 2px 6px;}
        .emotion-name{font-size:9px;}
        .tab-content{padding:4px 10px 0;}}
    `}</style>
  );
}
