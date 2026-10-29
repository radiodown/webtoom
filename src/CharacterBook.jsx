import React, { useState } from 'react';
import characters from './characters.generated.js';
import NavigationLink from './navigation.jsx';

function SettingImage({ image, name }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <figure className="character-sheet">
    <figcaption><h2>{image.title}</h2><a href={image.src} target="_blank" rel="noreferrer" aria-label={`${image.title} 원본 크게 보기 (새 탭)`}>원본 크게 보기 ↗</a></figcaption>
    {failed ? <div className="image-error" role="alert">설정 이미지를 불러오지 못했어요.<button onClick={() => { setAttempt(attempt + 1); setFailed(false); }}>다시 불러오기</button></div>
      : <img key={attempt} src={image.src} alt={`${name} 설정집 — ${image.title}`} width={image.width} height={image.height} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </figure>;
}

export default function CharacterBook({ character, navigate }) {
  return <main className="library character-book" id="main" tabIndex="-1">
    <section className="library-intro">
      <span className="episode-badge">CHARACTER BOOK</span>
      <h1>{character ? character.name : '인물 설정집'}<span className="brand-dot">.</span></h1>
      <p>{character ? `${character.name}의 캐릭터 디자인과 설정 자료를 모았어요.` : '이야기 속 여섯 인물의 모습을 조금 더 가까이 만나보세요.'}</p>
    </section>
    {character ? <>
      <NavigationLink id="characters" navigate={navigate} className="back-to-library">← 전체 인물</NavigationLink>
      <nav className="episode-tabs character-tabs" aria-label="설정집 인물 선택">
        {characters.map(item => <NavigationLink key={item.id} id={`character:${item.id}`} navigate={navigate} aria-current={item.id === character.id ? 'page' : undefined}>{item.name}</NavigationLink>)}
      </nav>
      {character.images.length ? <section aria-label={`${character.name} 설정 자료`} className="character-sheets">
        {character.images.map(image => <SettingImage key={image.src} image={image} name={character.name} />)}
      </section> : <div className="character-empty"><span aria-hidden="true">{character.name.slice(0, 1)}</span><h2>설정 자료 준비 중</h2><p>{character.name}의 설정 자료가 곧 이곳에 채워질 거예요.</p></div>}
    </> : <>
      <div className="library-heading"><h2>등장인물 <span>{characters.length}</span></h2><span>캐릭터 디자인 · 설정 자료</span></div>
      <section className="character-grid" aria-label="설정집 인물 목록">
        {characters.map(item => <NavigationLink key={item.id} id={`character:${item.id}`} navigate={navigate} className="character-card" aria-label={`${item.name} 설정집 보기`}>
          <div className="character-cover">{item.images.length ? <img src={item.images[0].src} alt="" width={item.images[0].width} height={item.images[0].height} loading="lazy" /> : <span className="character-initial" aria-hidden="true">{item.name.slice(0, 1)}</span>}</div>
          <div className="character-card-info"><span className="character-status">{item.images.length ? `설정 이미지 ${item.images.length}장` : '자료 준비 중'}</span><h2>{item.name}</h2><span className="card-read">설정집 보기 <span aria-hidden="true">→</span></span></div>
        </NavigationLink>)}
      </section>
    </>}
  </main>;
}
