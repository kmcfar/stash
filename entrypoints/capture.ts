import { Readability } from '@mozilla/readability';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';

export interface CaptureResult {
  url: string;
  title: string;
  description: string;
  favicon?: string;
  referrer?: string;
  excerpt?: string;
  text: string;
}

const MAX_TEXT = 6000;

function meta(selector: string): string {
  return document.querySelector<HTMLMetaElement>(selector)?.content?.trim() ?? '';
}

function favicon(): string | undefined {
  const link = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"], link[rel="apple-touch-icon"]',
  );
  return link?.href || undefined;
}

function readArticle(): { text: string; excerpt?: string } {
  try {
    const article = new Readability(document.cloneNode(true) as Document, {
      charThreshold: 200,
    }).parse();
    if (article?.textContent) {
      return { text: article.textContent, excerpt: article.excerpt ?? undefined };
    }
  } catch {
    // Fall through to the plain body text.
  }
  return { text: document.body?.innerText ?? '' };
}

/**
 * Injected into the active tab only when the user saves it. Reads metadata and
 * the main text; the background worker decides whether any of it may be sent
 * to a model.
 */
export default defineUnlistedScript((): CaptureResult => {
  const article = readArticle();
  const text = article.text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  return {
    url: location.href,
    title: meta('meta[property="og:title"]') || document.title,
    description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
    favicon: favicon(),
    referrer: document.referrer || undefined,
    excerpt: article.excerpt,
    text,
  };
});
