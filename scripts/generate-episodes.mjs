import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collator = new Intl.Collator('en', { numeric: true });
export const characterDefinitions = [
  { id: 'claude', name: '클로드' },
  { id: 'friday', name: '프라이데이' },
  { id: 'comgong', name: '컴공쿤' },
  { id: 'grok', name: '그록' },
  { id: 'gemini', name: '제미나이' },
  { id: 'codex', name: '코덱스' },
];

async function readPng(directory, file) {
  const bytes = await readFile(path.join(directory, file));
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`Invalid PNG: ${file}`);
  return { file, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export function compareImages(a, b) {
  const parts = name => {
    const stem = name.replace(/\.png$/i, '');
    const suffix = stem.match(/_(\d+)$/);
    return { group: suffix ? stem.slice(0, -suffix[0].length) : stem, order: suffix ? Number(suffix[1]) : -1 };
  };
  const left = parts(a), right = parts(b);
  return collator.compare(left.group, right.group) || left.order - right.order;
}

export async function scanEpisodes(directory = root) {
  const folders = (await readdir(directory, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^\d{2,}-.+/.test(entry.name))
    .sort((a, b) => collator.compare(a.name, b.name));
  const episodes = [];
  for (const folder of folders) {
    const [, id, title] = folder.name.match(/^(\d+)-(.+)$/);
    const files = (await readdir(path.join(directory, folder.name))).filter(name => /\.png$/i.test(name)).sort(compareImages);
    if (!files.length) continue;
    if (episodes.some(episode => episode.id === id)) throw new Error(`Duplicate episode: ${id}`);
    const images = [];
    for (const file of files) {
      images.push(await readPng(path.join(directory, folder.name), file));
    }
    episodes.push({ id, title, folder: folder.name, images });
  }
  if (!episodes.length) throw new Error('No episode images found. Add a numbered folder such as 01-title.');
  return episodes;
}

export async function scanCharacters(directory = root) {
  const folder = '설정집';
  const location = path.join(directory, folder);
  const entries = await readdir(location, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  return Promise.all(characterDefinitions.map(async character => {
    const files = entries.filter(entry => entry.isFile() && /\.png$/i.test(entry.name)
      && (entry.name.replace(/\.png$/i, '') === character.name || entry.name.startsWith(character.name) && /^[\s_.-]/.test(entry.name.slice(character.name.length))))
      .map(entry => entry.name);
    if (entries.some(entry => entry.isDirectory() && entry.name === character.name)) {
      const nested = await readdir(path.join(location, character.name), { withFileTypes: true });
      files.push(...nested.filter(entry => entry.isFile() && /\.png$/i.test(entry.name)).map(entry => `${character.name}/${entry.name}`));
    }
    files.sort(compareImages);
    const images = await Promise.all(files.map(async file => ({ ...await readPng(location, file), title: path.basename(file).replace(/\.png$/i, '') })));
    return { ...character, folder, images };
  }));
}

async function generate() {
  const episodes = await scanEpisodes();
  const characters = await scanCharacters();
  const imports = [];
  const records = episodes.map(episode => {
    const images = episode.images.map(image => {
      const symbol = `image${imports.length}`;
      imports.push(`import ${symbol} from ${JSON.stringify(`../${episode.folder}/${image.file}`)};`);
      return `{ src: ${symbol}, width: ${image.width}, height: ${image.height} }`;
    });
    return `{ id: ${JSON.stringify(episode.id)}, title: ${JSON.stringify(episode.title)}, images: [${images.join(',\n')}] }`;
  });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src/episodes.generated.js'), `${imports.join('\n')}\nexport default [${records.join(',\n')}];\n`);
  const characterImports = [];
  const characterRecords = characters.map(character => {
    const images = character.images.map(image => {
      const symbol = `image${characterImports.length}`;
      characterImports.push(`import ${symbol} from ${JSON.stringify(`../${character.folder}/${image.file}`)};`);
      return `{ src: ${symbol}, title: ${JSON.stringify(image.title)}, width: ${image.width}, height: ${image.height} }`;
    });
    return `{ id: ${JSON.stringify(character.id)}, name: ${JSON.stringify(character.name)}, images: [${images.join(',\n')}] }`;
  });
  await writeFile(path.join(root, 'src/characters.generated.js'), `${characterImports.join('\n')}\nexport default [${characterRecords.join(',\n')}];\n`);
  console.log(`Catalog: ${episodes.length} episodes, ${episodes.reduce((total, episode) => total + episode.images.length, 0)} images.`);
  console.log(`Character book: ${characters.length} characters, ${characters.reduce((total, character) => total + character.images.length, 0)} images.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generate();
