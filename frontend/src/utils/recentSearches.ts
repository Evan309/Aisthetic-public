// src/utils/recentSearches.ts
export type RecentSearch = {
  id: string;
  ownerKey: string; // "anon" | `auth0:${string}`
  mode: "text" | "image" | "multimodal";
  searchId?: string | null;          // ✅ NEW
  queryText?: string | null;
  queryImageUrl?: string | null;
  createdAt: string;
};

const KEY = "aisthetic:recentSearches:v2";
const MAX = 12;

function normalizeText(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function dedupeKey(item: Omit<RecentSearch, "id" | "createdAt">) {
  const t = item.queryText ? normalizeText(item.queryText) : "";
  const img = item.queryImageUrl ?? "";
  // ✅ Removed sid from key so re-searches replace the old entry
  return `${item.ownerKey}|${item.mode}|t:${t}|img:${img}`;
}

export function loadRecentSearches(ownerKey: string): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return (arr as RecentSearch[]).filter((x) => x.ownerKey === ownerKey);
  } catch {
    return [];
  }
}

function loadAll(): RecentSearch[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RecentSearch[]) : [];
  } catch {
    return [];
  }
}

function saveAll(items: RecentSearch[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addRecentSearch(input: {
  ownerKey: string;
  mode: RecentSearch["mode"];
  searchId?: string | null;          // ✅ NEW
  queryText?: string | null;
  queryImageUrl?: string | null;
}) {
  const all = loadAll();

  const base = {
    ownerKey: input.ownerKey,
    mode: input.mode,
    searchId: input.searchId ?? null,          // ✅ NEW
    queryText: input.queryText ?? null,
    queryImageUrl: input.queryImageUrl ?? null,
  };

  const key = dedupeKey(base);

  const filtered = all.filter((x) => {
    const xKey = dedupeKey({
      ownerKey: x.ownerKey,
      mode: x.mode,
      searchId: x.searchId ?? null,            // ✅ NEW
      queryText: x.queryText ?? null,
      queryImageUrl: x.queryImageUrl ?? null,
    });
    return xKey !== key;
  });

  const item: RecentSearch = {
    id: crypto.randomUUID(),
    ...base,
    createdAt: new Date().toISOString(),
  };

  const nextAll = [item, ...filtered];

  const perOwner = nextAll.filter((x) => x.ownerKey === input.ownerKey);
  const keepPerOwnerIds = new Set(perOwner.slice(0, MAX).map((x) => x.id));

  const capped = nextAll.filter(
    (x) => x.ownerKey !== input.ownerKey || keepPerOwnerIds.has(x.id)
  );

  saveAll(capped);
  return capped.filter((x) => x.ownerKey === input.ownerKey).slice(0, MAX);
}

export function removeRecentSearch(ownerKey: string, id: string) {
  const all = loadAll().filter((x) => !(x.ownerKey === ownerKey && x.id === id));
  saveAll(all);
  return all.filter((x) => x.ownerKey === ownerKey).slice(0, MAX);
}

export function clearRecentSearches(ownerKey: string) {
  const all = loadAll().filter((x) => x.ownerKey !== ownerKey);
  saveAll(all);
}
