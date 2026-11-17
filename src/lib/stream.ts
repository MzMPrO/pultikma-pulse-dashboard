/** Fake "AI" streaming helpers — reveal text and steps with human-like delays. */

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

/** Streams `text` word by word into `onChunk` (receives the full text so far). */
export async function streamText(
  text: string,
  onChunk: (soFar: string) => void,
  { delay = 28, signal }: { delay?: number; signal?: AbortSignal } = {},
) {
  const tokens = text.split(/(\s+)/);
  let out = "";
  for (const token of tokens) {
    out += token;
    onChunk(out);
    if (token.trim()) await sleep(delay + Math.random() * delay, signal);
  }
  return out;
}

/** Reveals steps one by one, calling `onStep(index)` after a randomized delay each. */
export async function revealSteps(
  count: number,
  onStep: (index: number) => void,
  { min = 600, max = 1500, signal }: { min?: number; max?: number; signal?: AbortSignal } = {},
) {
  for (let i = 0; i < count; i++) {
    await sleep(min + Math.random() * (max - min), signal);
    onStep(i);
  }
}
