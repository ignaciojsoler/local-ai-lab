/**
 * transformers.js stores every downloaded weight file in this Cache Storage
 * bucket, keyed by its Hugging Face URL. Reading it is how a page knows a
 * model is already on the device before offering to download it again.
 */
const CACHE_NAME = "transformers-cache";

function cacheStorage(): CacheStorage | null {
  // Absent in jsdom and on insecure origins.
  return typeof caches === "undefined" ? null : caches;
}

/** Every cached request whose URL belongs to `model`. */
async function entriesFor(model: string): Promise<Request[]> {
  const storage = cacheStorage();
  if (!storage) return [];

  try {
    if (!(await storage.has(CACHE_NAME))) return [];
    const cache = await storage.open(CACHE_NAME);
    const keys = await cache.keys();
    return keys.filter((request) => request.url.includes(`/${model}/`));
  } catch {
    return [];
  }
}

export async function isModelCached(model: string): Promise<boolean> {
  return (await entriesFor(model)).length > 0;
}

/** Total bytes the model occupies on this device, or null if unknown. */
export async function cachedModelSize(model: string): Promise<number | null> {
  const storage = cacheStorage();
  const requests = await entriesFor(model);
  if (!storage || requests.length === 0) return null;

  try {
    const cache = await storage.open(CACHE_NAME);
    let total = 0;
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      total += (await response.clone().arrayBuffer()).byteLength;
    }
    return total;
  } catch {
    return null;
  }
}

/** Removes the model's weights from the device. Returns how many files went. */
export async function clearModelCache(model: string): Promise<number> {
  const storage = cacheStorage();
  const requests = await entriesFor(model);
  if (!storage || requests.length === 0) return 0;

  try {
    const cache = await storage.open(CACHE_NAME);
    let removed = 0;
    for (const request of requests) {
      if (await cache.delete(request)) removed += 1;
    }
    return removed;
  } catch {
    return 0;
  }
}

/**
 * Decimal MB, deliberately: this figure is compared against the download size
 * quoted on the model's Hugging Face page, and that page counts 10^6 bytes to
 * the megabyte. Dividing by 1024 here would print MiB under an "MB" label and
 * undercount every model by about 5% against the number it is shown beside.
 */
export function formatBytes(bytes: number): string {
  const mb = bytes / 1e6;
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}
