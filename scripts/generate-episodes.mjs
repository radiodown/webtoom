import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collator = new Intl.Collator('en', { numeric: true });

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
      const bytes = await readFile(path.join(directory, folder.name, file));
      if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error(`Invalid PNG: ${folder.name}/${file}`);
      images.push({ file, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
    }
    episodes.push({ id, title, folder: folder.name, images });
  }
  if (!episodes.length) throw new Error('No episode images found. Add a numbered folder such as 01-title.');
  return episodes;
}

async function generate() {
  const episodes = await scanEpisodes();
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
  console.log(`Catalog: ${episodes.length} episodes, ${episodes.reduce((total, episode) => total + episode.images.length, 0)} images.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await generate();
