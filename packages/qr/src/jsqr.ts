import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
/**
 * Loads jsQR with the version-23 alignment centre corrected (74 → 78). Stock jsQR 1.4.0
 * cannot decode any version-23 symbol (cozmo/jsQR#251); the round-trip suite needs a reader
 * that matches ISO/IEC 18004 Annex E so a correct encoder is not blamed for the table typo.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type jsQRType from "jsqr";

/** The fourth alignment centre for version 23 in jsQR 1.4.0; ISO lists 78. */
const BROKEN_V23_ALIGNMENT = "alignmentPatternCenters: [6, 30, 54, 74, 102]";

/** Correct centres for version 23 per ISO/IEC 18004 Annex E Table E.1. */
const FIXED_V23_ALIGNMENT = "alignmentPatternCenters: [6, 30, 54, 78, 102]";

/**
 * jsQR with version 23's alignment pattern centres taken from the standard, so every
 * Model 2 version reaches the decoder's ECC stage instead of failing during sampling.
 */
function loadPatchedJsQR(): typeof jsQRType {
	let require = createRequire(import.meta.url);
	let entry = require.resolve("jsqr");
	let source = readFileSync(entry, "utf8").replaceAll(BROKEN_V23_ALIGNMENT, FIXED_V23_ALIGNMENT);
	let cacheDir = join(dirname(entry), "..", ".sdxc-jsqr-patched");
	mkdirSync(cacheDir, { recursive: true });
	let patched = join(cacheDir, "jsQR.js");
	writeFileSync(patched, source);
	return require(patched) as typeof jsQRType;
}

export default loadPatchedJsQR();
