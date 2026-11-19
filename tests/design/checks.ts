// The design checks of gallery stage 2: WCAG AA contrast, visible elements,
// no sideways page scroll, and at most one primary action that stands out.
// Each check returns its failures, one line each, so a test can assert that a
// good page has none and that a broken page fails with the right message.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export type Platform = { name: "desktop" | "mobile"; width: number; height: number };

/** The platforms in `design/README.md`. */
export const PLATFORMS: Platform[] = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

/** Below this width the grid scrolls inside its panel. */
const PHONE_MAX = 600;

/**
 * Axe `color-contrast` at WCAG 2 AA. A violation fails. An incomplete result
 * fails too, except (a) at the phone width, inside a `.panel` that scrolls
 * sideways, and (b) the "·" cell `td.empty`.
 */
export async function contrast(page: Page, where: string): Promise<string[]> {
  const width = page.viewportSize()!.width;
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  const failures: string[] = [];
  for (const node of results.violations.flatMap((v) => v.nodes)) {
    const data = node.any[0]?.data as
      | { fgColor: string; bgColor: string; contrastRatio: number; expectedContrastRatio: string }
      | undefined;
    failures.push(
      `${where} at ${width}px: ${node.target.join(" ")}: contrast ${data?.contrastRatio}:1 ` +
        `(${data?.fgColor} on ${data?.bgColor}), needs ${data?.expectedContrastRatio}`,
    );
  }
  for (const node of results.incomplete.flatMap((v) => v.nodes)) {
    const selector = node.target.join(" ");
    const skipped = await page.evaluate(
      ({ selector, phone }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        if (el.matches("td.empty")) return true;
        const panel = el.closest(".panel");
        return phone && !!panel && panel.scrollWidth > panel.clientWidth;
      },
      { selector, phone: width <= PHONE_MAX },
    );
    if (skipped) continue;
    const reason = node.any[0]?.message ?? "axe cannot judge the contrast";
    failures.push(`${where} at ${width}px: ${selector}: contrast not judged: ${reason}`);
  }
  return failures;
}

/** The page as a whole must not scroll sideways. */
export async function noPageScroll(page: Page, where: string): Promise<string[]> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  return scroll > client
    ? [`${where} at ${client}px: the page scrolls sideways: scrollWidth ${scroll}px > ${client}px`]
    : [];
}

/**
 * Every element with text, and every link and button, is visible: a box
 * larger than 0×0, not `visibility: hidden`, not opacity 0, and not cut by an
 * ancestor with `overflow: hidden` or `clip`. Elements under a `hidden`
 * attribute are not checked.
 */
export async function visibility(page: Page, where: string): Promise<string[]> {
  const width = page.viewportSize()!.width;
  const found = await page.evaluate(() => {
    const name = (el: Element) => {
      const id = el.id ? `#${el.id}` : "";
      const cls = [...el.classList].map((c) => `.${c}`).join("");
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ""}`;
    };
    const hasText = (el: Element) =>
      [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== "",
      );
    const out: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT"].includes(el.tagName)) continue;
      if (!(el.matches("a, button") || hasText(el))) continue;
      if (el.closest("[hidden]")) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) {
        out.push(`${name(el)}: box ${box.width}×${box.height}`);
        continue;
      }
      const style = getComputedStyle(el);
      if (style.visibility === "hidden") {
        out.push(`${name(el)}: visibility hidden`);
        continue;
      }
      for (let up: Element | null = el; up; up = up.parentElement) {
        const s = getComputedStyle(up);
        if (Number(s.opacity) === 0) {
          out.push(`${name(el)}: opacity 0 on ${name(up)}`);
          break;
        }
        if (up === el) continue;
        if (/hidden|clip/.test(`${s.overflowX} ${s.overflowY}`)) {
          const clip = up.getBoundingClientRect();
          const cut =
            box.left < clip.left - 1 ||
            box.top < clip.top - 1 ||
            box.right > clip.right + 1 ||
            box.bottom > clip.bottom + 1;
          if (cut) {
            out.push(
              `${name(el)}: cut by ${name(up)}: box ${Math.round(box.left)},${Math.round(box.top)} ` +
                `${Math.round(box.width)}×${Math.round(box.height)} outside ${Math.round(clip.left)},${Math.round(clip.top)} ` +
                `${Math.round(clip.width)}×${Math.round(clip.height)}`,
            );
            break;
          }
        }
      }
    }
    return out;
  });
  return found.map((f) => `${where} at ${width}px: ${f}`);
}

/**
 * At most one `.primary`. When there is one, its fill has at least 3:1 against
 * the background behind it, its label at least 4.5:1 against its fill, and no
 * other visible element has the accent colour as its background.
 */
export async function onePrimary(page: Page, where: string): Promise<string[]> {
  const width = page.viewportSize()!.width;
  const found = await page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parse = (c: string): Rgba => {
      const n = c.match(/[\d.]+/g)!.map(Number);
      return [n[0], n[1], n[2], n[3] ?? 1];
    };
    const over = (top: Rgba, bottom: Rgba): Rgba => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1) as Rgba;
    };
    /** The solid colour behind an element: its ancestors' backgrounds over white. */
    const behind = (el: Element | null): Rgba => {
      const layers: Rgba[] = [];
      for (let up = el; up; up = up.parentElement)
        layers.push(parse(getComputedStyle(up).backgroundColor));
      return layers.reverse().reduce((acc, layer) => over(layer, acc), [255, 255, 255, 1] as Rgba);
    };
    const lum = (c: Rgba) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: Rgba, b: Rgba) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };
    const hex = (c: Rgba) =>
      "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

    const out: string[] = [];
    const primaries = [...document.querySelectorAll(".primary")].filter(
      (el) => !el.closest("[hidden]"),
    );
    if (primaries.length > 1) {
      out.push(`${primaries.length} primary actions: ${primaries.map((p) => `"${p.textContent!.trim()}"`).join(", ")}`);
      return out;
    }
    if (primaries.length === 0) return out;
    const primary = primaries[0];
    const label = `.primary "${primary.textContent!.trim()}"`;
    const fill = behind(primary);
    const back = behind(primary.parentElement);
    const text = over(parse(getComputedStyle(primary).color), fill);
    const fillRatio = ratio(fill, back);
    if (fillRatio < 3)
      out.push(`${label}: fill ${hex(fill)} on ${hex(back)} is ${fillRatio}:1, needs 3:1`);
    const textRatio = ratio(text, fill);
    if (textRatio < 4.5)
      out.push(`${label}: label ${hex(text)} on ${hex(fill)} is ${textRatio}:1, needs 4.5:1`);

    const probe = document.createElement("div");
    probe.style.background = "var(--accent)";
    document.body.append(probe);
    const accent = getComputedStyle(probe).backgroundColor;
    probe.remove();
    for (const el of document.body.querySelectorAll("*")) {
      if (el === primary || primary.contains(el) || el.closest("[hidden]")) continue;
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) continue;
      if (getComputedStyle(el).backgroundColor === accent)
        out.push(`${label} does not stand out: ${el.tagName.toLowerCase()}.${[...el.classList].join(".")} has the accent ${accent} as its background too`);
    }
    return out;
  });
  return found.map((f) => `${where} at ${width}px: ${f}`);
}

/** Every check that runs on every page: contrast, visibility, and page scroll. */
export async function pageChecks(page: Page, where: string): Promise<string[]> {
  return [
    ...(await contrast(page, where)),
    ...(await visibility(page, where)),
    ...(await noPageScroll(page, where)),
  ];
}
