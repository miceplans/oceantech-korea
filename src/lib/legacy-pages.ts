import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { renderBoards, stripKboardHead } from './board';

const sourceRoot = path.resolve('src/legacy');
let sourceSet: Promise<Set<string>> | undefined;

export interface LegacyPage {
  source: string;
  route: string;
  head: string;
  body: string;
  bodyClass: string;
  lang: string;
  redirect?: string;
}

async function htmlFiles(directory: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'wp-content' || entry.name === 'wp-includes') return [];
      return htmlFiles(path.join(directory, entry.name), relative);
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [relative] : [];
  }));
  return files.flat().sort();
}

export async function listLegacyPages(): Promise<string[]> {
  return htmlFiles(sourceRoot);
}

export function routeFor(source: string): string {
  if (source === 'index.html') return '/';
  return `/${source}`;
}

export async function loadLegacyPage(source: string): Promise<LegacyPage> {
  const html = await readFile(path.join(sourceRoot, source), 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  const body = html.match(/<body\b([^>]*)>([\s\S]*?)(?:<\/body>|$)/i);
  if (!head || !body) throw new Error(`Invalid HTML page: ${source}`);

  // Preserve the saved page markup and its styles while serving every route
  // through Astro. Replace links to the old domain with same-origin paths.
  const localize = (markup: string) => markup.replace(/%3F(?=(?:ver|v)=)/gi, '?').replace(
    /https:\/\/k-oceantech\.org(\/[^\s"'<>)]*)/g,
    (url, pathname: string) => {
      const asset = pathname.split(/[?#]/, 1)[0];
      if (asset.startsWith('/wp-') && !existsSync(path.resolve('public', decodeURIComponent(asset.slice(1))))) {
        return url;
      }
      return pathname;
    },
  );

  sourceSet ??= listLegacyPages().then((files) => new Set(files));
  const boardBody = renderBoards(body[2], { source, sources: await sourceSet });

  return {
    source,
    route: routeFor(source),
    head: localize(stripKboardHead(head)).replace(
      /(<meta property="og:url" content=")\/q-kboard_content_redirect-\d+\.html/,
      `$1${routeFor(source)}`,
    ),
    body: localize(boardBody),
    bodyClass: body[1].match(/\bclass=["']([^"']*)["']/i)?.[1] ?? '',
    lang: html.match(/<html\b[^>]*\blang=["']([^"']*)["']/i)?.[1] ?? 'ko',
    redirect: !html.includes('</body>')
      ? html.match(/window\.location\.href=["']([^"']+)["']/)?.[1]
      : undefined,
  };
}
