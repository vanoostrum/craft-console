/** A plan ticket from `craft:plan` has a title that starts with this (GLOSSARY: Plan). */
export const PLAN_PREFIX = "Plan: ";

export const isPlanTitle = (title: string) => title.startsWith(PLAN_PREFIX);

const LINK = /\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*\)/g;

/**
 * The URL of the brief that a plan ticket links: the first Markdown link whose
 * text starts with "Brief: " and whose URL has `/document/`. Null for a ticket
 * that is not a plan ticket, and when there is no such link.
 */
export function briefOf(
  title: string,
  description: string | null,
): string | null {
  if (!isPlanTitle(title) || description === null) return null;
  for (const [, text, url] of description.matchAll(LINK))
    if (text.startsWith("Brief: ") && url.includes("/document/")) return url;
  return null;
}

/**
 * The document id of a brief URL: the hex id after the last `-` of the path
 * part after `/document/`. It stays the same when the brief is renamed.
 */
export function briefId(url: string): string | null {
  const slug = /\/document\/([^/?#]+)/.exec(url)?.[1];
  if (slug === undefined) return null;
  const id = slug.slice(slug.lastIndexOf("-") + 1);
  return /^[0-9a-f]+$/.test(id) ? id : null;
}

/** Two brief URLs name the same brief when both have the same document id. */
export function sameBrief(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const id = briefId(a);
  return id !== null && id === briefId(b);
}
