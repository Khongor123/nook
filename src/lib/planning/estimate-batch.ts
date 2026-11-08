/** Complete one bounded round; failures do not discard successfully estimated items. */
export async function estimateBatch<T>(items: readonly T[], run: (item: T) => Promise<void>,
  progress: (completed: number, total: number) => void = () => {}, cancelled: () => boolean = () => false,
) {
  let next = 0, completed = 0;
  progress(0, items.length);
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, async () => {
    while (next < items.length && !cancelled()) {
      const item = items[next++];
      try { await run(item); } catch { /* Caller records safe per-item failure; continue the import. */ }
      completed++; if (!cancelled()) progress(completed, items.length);
    }
  }));
}
