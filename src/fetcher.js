/**
 * fetcher.js
 * RSSフィードを取得・パースしてアイテム一覧を返す
 */

import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

/**
 * 単一RSSフィードを取得
 */
async function fetchFeed(source) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "MHLWMonitor/1.0 (health-regulation-tracker)" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${source.url}`);
  }

  const text = await res.text();
  return parseFeed(text, source);
}

/**
 * RSS/Atomをパースして正規化アイテム配列を返す
 */
function parseFeed(xml, source) {
  const parsed = parser.parse(xml);
  const items = [];

  // RSS 2.0
  const channel = parsed?.rss?.channel;
  if (channel) {
    const rawItems = Array.isArray(channel.item)
      ? channel.item
      : channel.item
        ? [channel.item]
        : [];
    for (const it of rawItems) {
      const link = it.link || it.guid || "";
      items.push({
        id: makeId(link, it.title),
        title: normalizeText(it.title || ""),
        link: link.trim(),
        description: normalizeText(
          it.description || it["content:encoded"] || "",
        ),
        pubDate: parseDate(it.pubDate || it.date || ""),
        source: source.name,
      });
    }
    return items;
  }

  // RSS 1.0 / RDF
  const rdf = parsed?.["rdf:RDF"];
  if (rdf) {
    const rawItems = Array.isArray(rdf.item)
      ? rdf.item
      : rdf.item
        ? [rdf.item]
        : [];
    for (const it of rawItems) {
      const link = it.link || it["@_rdf:about"] || "";
      items.push({
        id: makeId(link, it.title),
        title: normalizeText(it.title || ""),
        link: link.trim(),
        description: normalizeText(it.description || ""),
        pubDate: parseDate(it["dc:date"] || ""),
        source: source.name,
      });
    }
    return items;
  }

  // Atom
  const feed = parsed?.feed;
  if (feed) {
    const rawItems = Array.isArray(feed.entry)
      ? feed.entry
      : feed.entry
        ? [feed.entry]
        : [];
    for (const it of rawItems) {
      const link = it.link?.["@_href"] || it.id || "";
      items.push({
        id: makeId(link, it.title),
        title: normalizeText(
          typeof it.title === "object" ? it.title["#text"] : it.title || "",
        ),
        link: link,
        description: normalizeText(it.summary || it.content || ""),
        pubDate: parseDate(it.updated || it.published || ""),
        source: source.name,
      });
    }
    return items;
  }

  return items;
}

function makeId(link, title) {
  const raw = (link || title || "") + "";
  return createHash("sha256").update(raw.trim()).digest("hex").slice(0, 16);
}

function normalizeText(str) {
  if (typeof str !== "string") str = String(str || "");
  // HTMLタグを除去
  return str
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 全ソースのフィードを並列取得
 */
export async function fetchAllSources(sources) {
  const results = await Promise.allSettled(sources.map(fetchFeed));
  const allItems = [];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      allItems.push(...r.value);
      console.log(`  ✓ ${sources[i].name}: ${r.value.length}件`);
    } else {
      console.error(`  ✗ ${sources[i].name}: ${r.reason?.message}`);
    }
  }

  return allItems;
}
