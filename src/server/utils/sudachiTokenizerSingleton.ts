/**
 * Sudachi WASM tokenizer singleton (Node server only, admin auto-fill).
 * Package: sudachi (hata6502/sudachi-wasm). Large single-file bundle; trace in next.config.js.
 */

export type SudachiToken = {
  surface: string;
  poses: string[];
  normalized_form: string;
  reading_form: string;
  dictionary_form: string;
};

type SudachiModule = typeof import('sudachi');

let sudachiPromise: Promise<SudachiModule> | null = null;

export function getSudachiModule(): Promise<SudachiModule> {
  if (!sudachiPromise) {
    sudachiPromise = import('sudachi');
  }
  return sudachiPromise;
}

/**
 * Tokenize with mode C (longest units). Returns parsed token array.
 */
export async function tokenizeSudachiModeC(text: string): Promise<SudachiToken[]> {
  const m = await getSudachiModule();
  const raw = m.tokenize(text, m.TokenizeMode.C);
  return JSON.parse(raw) as SudachiToken[];
}
