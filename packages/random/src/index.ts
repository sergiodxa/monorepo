/**
 * The package entrypoint: the `Random` interface a consumer accepts, the seeded
 * stream a caller replays or persists, and the Web Crypto stream for values that
 * only need a good spread. It has no dependencies; the snapshot parser lives in
 * `@sdxc/random/schema`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type { Random } from "./draws.js";

export type { RandomState, Seed, SeededRandom } from "./seeded.js";

export { createRandom, restoreRandom } from "./seeded.js";

export { systemRandom, systemSeed } from "./system.js";
