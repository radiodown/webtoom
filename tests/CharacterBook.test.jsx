import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import App from '../src/App.jsx';
import characters from '../src/characters.generated.js';
import episodes from '../src/episodes.generated.js';
import { scanCharacters, characterDefinitions } from '../scripts/generate-episodes.mjs';

const temporaryDirectories = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('character catalog', () => {
  it('keeps all six characters available when no setting book exists', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'webtoon-characters-'));
    temporaryDirectories.push(directory);
    const catalog = await scanCharacters(directory);
    expect(catalog.map(({ id, name }) => ({ id, name }))).toEqual(characterDefinitions);
    expect(catalog.every(character => character.images.length === 0)).toBe(true);
  });

  it('matches flat files by name boundary and naturally sorts nested images', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'webtoon-characters-'));
    temporaryDirectories.push(directory);
    const folder = path.join(directory, '설정집');
    await mkdir(path.join(folder, '프라이데이'), { recursive: true });
    const png = Buffer.alloc(24);
    Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
    png.writeUInt32BE(1200, 16);
    png.writeUInt32BE(800, 20);
    for (const file of ['클로드 디자인.png', '클로드별개.png', '프라이데이/10.png', '프라이데이/2.png', '프라이데이/1.png']) await writeFile(path.join(folder, file), png);
    const catalog = await scanCharacters(directory);
    expect(catalog[0].images.map(image => image.file)).toEqual(['클로드 디자인.png']);
    expect(catalog[1].images.map(image => image.file)).toEqual(['프라이데이/1.png', '프라이데이/2.png', '프라이데이/10.png']);
    expect(catalog[1].images[0]).toMatchObject({ title: '1', width: 1200, height: 800 });
    await writeFile(path.join(folder, '그록 시트.png'), 'broken image');
    await expect(scanCharacters(directory)).rejects.toThrow('Invalid PNG');
  });
});

describe('character book navigation', () => {
  it('opens a separate six-character library and returns to the episode list', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('link', { name: '설정집', exact: true }));
    expect(location.search).toBe('?view=characters');
    expect(screen.queryByRole('region', { name: '전체 회차 목록' })).toBeNull();
    const list = screen.getByRole('region', { name: '설정집 인물 목록' });
    expect(within(list).getAllByRole('link')).toHaveLength(6);
    expect(within(list).getAllByRole('heading').map(heading => heading.textContent)).toEqual(['클로드', '프라이데이', '컴공쿤', '그록', '제미나이', '코덱스']);
    fireEvent.click(screen.getByRole('link', { name: '클로드 설정집 보기' }));
    expect(location.search).toBe('?view=characters&character=claude');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('클로드.');
    const sheets = screen.getByRole('region', { name: '클로드 설정 자료' });
    expect(within(sheets).getAllByRole('img')).toHaveLength(characters[0].images.length);
    expect(within(sheets).getAllByRole('link').every(link => link.target === '_blank')).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: '회차 목록', exact: true }));
    expect(within(screen.getByRole('region', { name: '전체 회차 목록' })).getAllByRole('link')).toHaveLength(episodes.length);
    expect(location.search).toBe('');
  });

  it('supports direct links, missing materials, history changes and unknown characters', () => {
    history.replaceState(null, '', '/webtoom/?view=characters&character=claude');
    render(<App />);
    expect(document.title).toBe('클로드 · 설정집 — 나의 웹툰');
    const empty = characters.find(character => !character.images.length);
    if (empty) {
      fireEvent.click(within(screen.getByRole('navigation', { name: '설정집 인물 선택' })).getByRole('link', { name: empty.name, exact: true }));
      expect(screen.getByRole('heading', { name: '설정 자료 준비 중' })).toBeTruthy();
    }
    act(() => { history.replaceState(null, '', '/webtoom/?view=characters'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByRole('region', { name: '설정집 인물 목록' })).toBeTruthy();
    act(() => { history.replaceState(null, '', '/webtoom/?view=characters&character=unknown'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByRole('region', { name: '설정집 인물 목록' })).toBeTruthy();
  });
});
