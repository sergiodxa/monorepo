/**
 * The rendered social cards, kept in R2 behind `remix/file-storage`'s `FileStorage`, so the
 * image route reads and writes `File`s and a test can stand in any other backend. A card is
 * stored once per template and content and never rewritten.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FileStorage } from "remix/file-storage";

import { R2FileStorage } from "@sdxc/file-storage-r2";
import { env } from "cloudflare:workers";

/** The storage the image route keeps rendered cards in. */
export function socialCards(): FileStorage {
	return new R2FileStorage(env.SOCIAL_CARDS);
}
