import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import App from '../src/App.jsx';
import episodes from '../src/episodes.generated.js';
import { compareImages, scanEpisodes } from '../scripts/generate-episodes.mjs';

describe('episode catalog', () => {
  it('finds all uploaded images with correct dimensions and natural ordering', async () => {
    const catalog = await scanEpisodes();
    expect(catalog.slice(0, 3).map(item => item.id)).toEqual(['01', '02', '03']);
    expect(catalog.map(item => item.images.length)).toEqual(episodes.map(item => item.images.length));
    expect(catalog[0].images[0].file).toBe('KakaoTalk_20261028_174440470.png');
    expect(catalog.every(item => item.images.every(image => image.width > 0 && image.height > 0))).toBe(true);
    expect(['10.png', '2.png', '1.png'].sort(compareImages)).toEqual(['1.png', '2.png', '10.png']);
    expect(['base_10.png', 'base_01.png', 'base.png', 'base_02.png'].sort(compareImages)).toEqual(['base.png', 'base_01.png', 'base_02.png', 'base_10.png']);
  });
});

describe('React viewer', () => {
  it('shows all three episodes on the landing page and navigates without reloading', () => {
    render(<App />);
    const list = screen.getByRole('region', { name: '전체 회차 목록' });
    expect(within(list).getAllByRole('link')).toHaveLength(episodes.length);
    fireEvent.click(screen.getByRole('link', { name: '1화 클로드 읽기' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('클로드');
    expect(location.search).toBe('?episode=01');
    expect(location.pathname).toBe('/webtoom/');
    const reader = screen.getByRole('region', { name: '웹툰 본문' });
    expect(within(reader).getAllByRole('img')).toHaveLength(episodes.find(item => item.id === '01').images.length);
    const tabs = screen.getByRole('navigation', { name: '회차 선택' });
    fireEvent.click(within(tabs).getByRole('link', { name: '2화 · 프라이데이' }));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('프라이데이');
    expect(location.search).toBe('?episode=02');
    fireEvent.click(screen.getByRole('link', { name: '회차 목록' }));
    expect(screen.getByRole('region', { name: '전체 회차 목록' })).toBeTruthy();
  });

  it('opens direct links and handles back/forward URL changes', () => {
    history.replaceState(null, '', '/webtoom/?episode=02');
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('프라이데이');
    act(() => { history.replaceState(null, '', '/webtoom/?episode=03'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('컨텍스트 0%');
    expect(within(screen.getByRole('region', { name: '웹툰 본문' })).getAllByRole('img')).toHaveLength(episodes.find(item => item.id === '03').images.length);
    const nav = screen.getByRole('navigation', { name: '이전 다음 회차' });
    fireEvent.click(within(nav).getByRole('link', { name: '이전 화: 2화 프라이데이' }));
    expect(location.search).toBe('?episode=02');
  });

  it('persists theme, width and gap, and supports resetting them', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '밝은 화면으로 변경' }));
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: '보기 설정' }));
    fireEvent.change(screen.getByLabelText('이미지 너비'), { target: { value: '1054' } });
    fireEvent.change(screen.getByLabelText('이미지 사이 간격'), { target: { value: '24' } });
    expect(JSON.parse(localStorage.getItem('webtoon:settings'))).toEqual({ width: 1054, gap: 24, theme: 'light' });
    fireEvent.click(screen.getByRole('button', { name: '기본 설정으로 되돌리기' }));
    expect(document.documentElement.style.getPropertyValue('--image-gap')).toBe('12px');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('offers a retry for failed images', () => {
    history.replaceState(null, '', '/webtoom/?episode=01');
    render(<App />);
    const image = screen.getByRole('img', { name: '1화 클로드 — 1번째 이미지' });
    fireEvent.error(image);
    expect(screen.getByRole('alert').textContent).toContain('1번째 이미지를 불러오지 못했어요.');
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(screen.getByRole('img', { name: '1화 클로드 — 1번째 이미지' })).toBeTruthy();
  });

  it('restores the saved image position', async () => {
    history.replaceState(null, '', '/webtoom/?episode=01');
    localStorage.setItem('webtoon:position:01', JSON.stringify({ page: 2, fraction: 0.4 }));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const index = this.id?.startsWith('page-') ? Number(this.id.slice(5)) - 1 : 0;
      const top = 400 + index * 1012 - window.scrollY;
      return { top, bottom: top + 1000, height: 1000, left: 0, right: 800, width: 800 };
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '이어서 읽기 ↘' }));
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 2604, behavior: 'instant' }));
    fireEvent.scroll(window);
    await waitFor(() => expect(JSON.parse(localStorage.getItem('webtoon:position:01')).page).toBe(2));
  });

  it('falls back to the episode list for an unknown episode', () => {
    history.replaceState(null, '', '/webtoom/?episode=99');
    render(<App />);
    expect(screen.getByRole('region', { name: '전체 회차 목록' })).toBeTruthy();
  });
});
