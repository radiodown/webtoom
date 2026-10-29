import React, { useEffect, useRef, useState } from 'react';

export default function ShareEpisode({ episode }) {
  const [status, setStatus] = useState('idle');
  const input = useRef(null);
  const timer = useRef(null);
  // 공유 주소에는 회차만 담고 캐시 확인용 쿼리나 스크롤 위치는 제외합니다.
  const url = new URL(`${import.meta.env.BASE_URL}?episode=${episode.id}`, location.origin).href;

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (status === 'manual') { input.current?.focus(); input.current?.select(); }
  }, [status]);

  async function copy() {
    clearTimeout(timer.current);
    setStatus('copying');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('manual');
    }
  }

  return <div className="episode-share">
    <div className="share-controls">
      <button className="share-button" onClick={copy} disabled={status === 'copying'} aria-label={`${Number(episode.id)}화 링크 복사`}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m10 13 4-4m-6 7-1 1a4.24 4.24 0 0 1-6-6l4-4a4.24 4.24 0 0 1 6 0m2 4a4.24 4.24 0 0 0 6 0l4-4a4.24 4.24 0 0 0-6-6l-1 1" transform="translate(1 2) scale(.9)" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        {status === 'copied' ? '복사됨 ✓' : status === 'copying' ? '복사 중…' : '링크 복사'}
      </button>
      <span className="share-feedback" role="status">{status === 'copied' ? `${Number(episode.id)}화 링크를 복사했어요.` : status === 'manual' ? '아래 주소를 선택해 복사해 주세요.' : ''}</span>
    </div>
    {status === 'manual' && <input ref={input} className="share-url" type="text" aria-label="회차 공유 주소" value={url} readOnly onFocus={event => event.currentTarget.select()} />}
  </div>;
}
