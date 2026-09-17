/**
 * SHA-256, synchronous, no imports.
 *
 * WHY THIS EXISTS RATHER THAN `node:crypto`. `pda.ts` used `createHash` from
 * `node:crypto`, which every test passed against because vitest runs in Node.
 * The first browser build failed outright: "Reading from node:crypto is not
 * handled by plugins". A module whose entire purpose is to be portable to
 * somebody else's stack had a Node-only dependency at its base, and no unit test
 * could have found it - only asking a bundler to run it in a browser could.
 *
 * WHY NOT Web Crypto. `crypto.subtle.digest` is in both runtimes and is the
 * obvious answer, but it is ASYNC. PDA derivation hashes in a loop, up to 256
 * times, to find an off-curve address; making that async turns every caller
 * async - `battlePda`, `mintPda`, both instruction builders, message
 * serialization. An async `battlePda()` is a worse public API than sixty lines
 * of a standard algorithm.
 *
 * So: the reference implementation, verified against `node:crypto` over a wide
 * range of inputs including the exact sizes PDA derivation produces. That check
 * is the whole reason this is safe to hand-roll - it is not trusted, it is
 * compared with the implementation it replaces.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(input: Uint8Array): Uint8Array {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  // Pad: the message, a 1 bit, zeros, then the bit length as a 64-bit big-endian.
  const bitLen = input.length * 8;
  const withOne = input.length + 1;
  const blocks = Math.ceil((withOne + 8) / 64);
  const padded = new Uint8Array(blocks * 64);
  padded.set(input);
  padded[input.length] = 0x80;
  // Length as 64 bits. Only the low 32 are written from a number, which is exact
  // for any input under 512MB - far beyond anything this hashes, and the high
  // word is written too so the padding is correct rather than merely adequate.
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let b = 0; b < blocks; b++) {
    const base = b * 64;
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(base + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, bb, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e;
      e = (d + t1) >>> 0;
      d = c; c = bb; bb = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + bb) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}
