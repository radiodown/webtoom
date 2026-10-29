import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import episodes from './episodes.generated.js';
import { defaults, readSettings, readPosition, writeStorage } from './storage.js';

const episodeHref = id => `${import.meta.env.BASE_URL}${id ? `?episode=${id}` : ''}`;
const routeId = () => new URLSearchParams(location.search).get('episode')?.padStart(2, '0') || null;
const behavior = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

function BookIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4.5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4zM12 5.5v15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

function EpisodeLink({ id, navigate, children, ...props }) {
  return <a href={episodeHref(id)} {...props} onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(id);
  }}>{children}</a>;
}

function Settings({ open, close, settings, setSettings }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (open && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current.open) dialog.current.close();
  }, [open]);
  return <dialog ref={dialog} aria-labelledby="settings-title" onCancel={close} onClose={close} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <div className="dialog-heading"><div><span className="dialog-eyebrow">MAKE YOURSELF COMFORTABLE</span><h2 id="settings-title">편안하게 읽기</h2></div><button className="icon-button" onClick={close} aria-label="보기 설정 닫기">×</button></div>
    <label className="setting-label" htmlFor="reader-width">이미지 너비</label>
    <select id="reader-width" value={settings.width} onChange={event => setSettings({ ...settings, width: Number(event.target.value) })}><option value="640">아담하게 · 640px</option><option value="800">기본 · 800px</option><option value="1054">넓게 · 1054px</option></select>
    <div className="setting-row"><label className="setting-label" htmlFor="image-gap">이미지 사이 간격</label><output htmlFor="image-gap">{settings.gap}px</output></div>
    <input id="image-gap" type="range" min="4" max="40" step="2" value={settings.gap} onChange={event => setSettings({ ...settings, gap: Number(event.target.value) })} />
    <div className="range-labels"><span>좁게</span><span>넉넉하게</span></div>
    <p className="settings-note">설정과 읽던 위치는 이 브라우저에 저장돼요.</p>
    <button className="reset-button" onClick={() => setSettings({ ...defaults })}>기본 설정으로 되돌리기</button>
  </dialog>;
}

function Library({ navigate }) {
  return <main className="library" id="main" tabIndex="-1">
    <section className="library-intro"><span className="episode-badge">MY LITTLE WEBTOON LIBRARY</span><h1>이야기가 머무는<br />나만의 작은 서재<span className="brand-dot">.</span></h1><p>읽고 싶은 회차를 골라, 천천히 스크롤해 보세요.</p></section>
    <div className="library-heading"><h2>전체 회차 <span>{episodes.length}</span></h2><span>1화부터 차례대로</span></div>
    <section className="episode-grid" aria-label="전체 회차 목록">
      {episodes.map(episode => <EpisodeLink key={episode.id} id={episode.id} navigate={navigate} className="episode-card" aria-label={`${Number(episode.id)}화 ${episode.title} 읽기`}>
        <div className="episode-cover"><img src={episode.images[0].src} alt="" width={episode.images[0].width} height={episode.images[0].height} /><span className="cover-number">{episode.id}</span><span className="cover-arrow" aria-hidden="true">↗</span></div>
        <div className="episode-card-meta"><span>EPISODE {episode.id}</span><span>{episode.images.length}장</span></div><h3>{episode.title}</h3><span className="card-read">{Number(episode.id)}화 읽기 <span aria-hidden="true">→</span></span>
      </EpisodeLink>)}
    </section>
  </main>;
}

function ComicImage({ image, episode, index, pageRef }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <figure className="comic-page" id={`page-${index + 1}`} ref={pageRef}>
    {!failed ? <img key={attempt} src={image.src} width={image.width} height={image.height} alt={`${Number(episode.id)}화 ${episode.title} — ${index + 1}번째 이미지`} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} onError={() => setFailed(true)} /> : <div className="image-error" role="alert">{index + 1}번째 이미지를 불러오지 못했어요.<button onClick={() => { setAttempt(attempt + 1); setFailed(false); }}>다시 불러오기</button></div>}
  </figure>;
}

function Reader({ episode, navigate, settings }) {
  const pageRefs = useRef([]);
  const latest = useRef(null);
  const [position, setPosition] = useState({ page: 1, progress: 0 });
  const [resume] = useState(() => readPosition(episode));
  const [showResume, setShowResume] = useState(() => !!resume && (resume.page > 0 || resume.fraction >= 0.1));
  const episodeIndex = episodes.findIndex(item => item.id === episode.id);
  const previous = episodes[episodeIndex - 1], next = episodes[episodeIndex + 1];

  useLayoutEffect(() => {
    let frame = 0, timer;
    const save = () => { if (latest.current) writeStorage(`webtoon:position:${episode.id}`, latest.current); };
    const update = () => {
      frame = 0;
      const pages = pageRefs.current;
      if (!pages.length || !pages[0]) return;
      const first = pages[0].getBoundingClientRect(), last = pages.at(-1).getBoundingClientRect();
      if (first.height <= 0) return;
      const marker = Math.min(innerHeight * 0.3, 220);
      let index = 0;
      for (let i = 0; i < pages.length; i++) { if (pages[i].getBoundingClientRect().top <= marker) index = i; else break; }
      const rect = pages[index].getBoundingClientRect();
      setPosition({ page: index + 1, progress: Math.max(0, Math.min(1, (innerHeight - first.top) / Math.max(1, last.bottom - first.top))) });
      if (first.top < marker) {
        latest.current = { page: index, fraction: Math.max(0, Math.min(1, (marker - rect.top) / Math.max(1, rect.height))) };
        clearTimeout(timer);
        timer = setTimeout(save, 200);
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const visibility = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', visibility);
    schedule();
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); save(); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); };
  }, [episode, settings.width, settings.gap, showResume]);

  function resumeReading() {
    setShowResume(false);
    requestAnimationFrame(() => {
      const rect = pageRefs.current[resume.page].getBoundingClientRect();
      window.scrollTo({ top: scrollY + rect.top + rect.height * resume.fraction - Math.min(innerHeight * 0.3, 220), behavior: behavior() });
    });
  }

  return <>
    <div className="reader-progress" style={{ width: `${position.progress * 100}%` }} aria-hidden="true" />
    <main id="main">
      <section className="episode-intro" aria-labelledby="episode-title">
        <EpisodeLink navigate={navigate} className="back-to-library">← 전체 회차</EpisodeLink>
        <nav className="episode-tabs" aria-label="회차 선택">{episodes.map(item => <EpisodeLink key={item.id} id={item.id} navigate={navigate} aria-current={item.id === episode.id ? 'page' : undefined}>{Number(item.id)}화 · {item.title}</EpisodeLink>)}</nav>
        <div className="episode-meta"><span className="episode-badge">EPISODE {episode.id}</span><span>{episode.images.length}장의 이야기</span></div>
        <div className="title-row"><h1 id="episode-title">{episode.title}</h1><span className="reader-episode-number">{Number(episode.id)}화</span></div>
        <p className="reading-hint">아래로 스크롤하며 천천히 읽어보세요 <span aria-hidden="true">↓</span></p>
        {showResume && <div className="resume-bar"><span>{resume.page + 1}번째 이미지까지 읽었어요.</span><button onClick={resumeReading}>이어서 읽기 ↘</button><button className="resume-dismiss" onClick={() => setShowResume(false)} aria-label="이어서 읽기 안내 닫기">×</button></div>}
      </section>
      <section className="reader" id="reader" aria-label="웹툰 본문" tabIndex="-1">{episode.images.map((image, index) => <ComicImage key={image.src} image={image} episode={episode} index={index} pageRef={node => { pageRefs.current[index] = node; }} />)}</section>
      <section className="episode-end"><span className="end-mark" aria-hidden="true">✦</span><p className="end-eyebrow">EPISODE {episode.id} · END</p><h2>여기까지, 오늘의 이야기.</h2><p>{Number(episode.id)}화를 모두 읽었어요. 함께해 주셔서 고마워요.</p><button className="restart-button" onClick={() => pageRefs.current[0]?.scrollIntoView({ behavior: behavior(), block: 'start' })}>처음부터 다시 읽기 ↑</button>
        <nav className="adjacent-episodes" aria-label="이전 다음 회차">
          {previous && <EpisodeLink id={previous.id} navigate={navigate} aria-label={`이전 화: ${Number(previous.id)}화 ${previous.title}`}><small>← 이전 화</small><span>{Number(previous.id)}화 · {previous.title}</span></EpisodeLink>}
          {next && <EpisodeLink id={next.id} navigate={navigate} aria-label={`다음 화: ${Number(next.id)}화 ${next.title}`}><small>다음 화 →</small><span>{Number(next.id)}화 · {next.title}</span></EpisodeLink>}
        </nav>
        <EpisodeLink navigate={navigate} className="end-library-link">전체 회차 보기</EpisodeLink>
      </section>
    </main>
    <aside className="reading-position" aria-label="읽기 위치"><span className="position-dot" aria-hidden="true" /><span><strong>{position.page}</strong><span className="position-total"> / {episode.images.length}</span></span><span className="position-divider" aria-hidden="true" /><button onClick={() => window.scrollTo({ top: 0, behavior: behavior() })} aria-label="맨 위로 이동">↑</button></aside>
  </>;
}

export default function App() {
  const [id, setId] = useState(routeId);
  const [settings, setSettings] = useState(readSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const episode = episodes.find(item => item.id === id);

  function navigate(nextId) {
    const normalized = nextId || null;
    if (normalized === id) { window.scrollTo({ top: 0, behavior: behavior() }); return; }
    history.pushState(null, '', episodeHref(normalized));
    setId(normalized);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  useEffect(() => {
    history.scrollRestoration = 'manual';
    const pop = () => { setId(routeId()); window.scrollTo({ top: 0, behavior: 'instant' }); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  useEffect(() => { document.title = episode ? `${Number(episode.id)}화 · ${episode.title} — 나의 웹툰` : '나의 웹툰 — 회차 목록'; }, [episode]);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.style.setProperty('--reader-width', `${settings.width}px`);
    root.style.setProperty('--image-gap', `${settings.gap}px`);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'dark' ? '#171918' : '#f4f4ef');
    writeStorage('webtoon:settings', settings);
  }, [settings]);

  return <>
    <a className="skip-link" href={episode ? '#reader' : '#main'}>본문으로 바로 가기</a>
    <header className="site-header"><EpisodeLink navigate={navigate} className="brand" aria-label="나의 웹툰 전체 회차"><BookIcon /><span>나의 웹툰<span className="brand-dot">.</span></span></EpisodeLink><span className="header-episode">{episode ? `${episode.id} / ${episode.title}` : `전체 ${episodes.length}개 회차`}</span><nav className="header-actions" aria-label="뷰어 도구"><EpisodeLink navigate={navigate} className="header-library-link">회차 목록</EpisodeLink><button className="icon-button" onClick={() => setSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })} aria-label={settings.theme === 'dark' ? '밝은 화면으로 변경' : '어두운 화면으로 변경'}>{settings.theme === 'dark' ? '☼' : '☾'}</button><button className="settings-button" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>보기 설정</button></nav></header>
    {episode ? <Reader key={episode.id} episode={episode} navigate={navigate} settings={settings} /> : <Library navigate={navigate} />}
    <footer className="site-footer"><span>나의 웹툰.</span><span>이야기가 머무는 작은 공간</span></footer>
    <Settings open={settingsOpen} close={() => setSettingsOpen(false)} settings={settings} setSettings={setSettings} />
  </>;
}
