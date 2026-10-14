/**
 * jsQR with version 23's alignment centres taken from ISO/IEC 18004 Annex E
 * Table E.1 (`78` in place of stock jsQR 1.4.0's `74`, cozmo/jsQR#251). The
 * round-trip suite loads this so every Model 2 version reaches ECC decoding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type jsQRType from "jsqr";

/** The fourth alignment centre for version 23 in jsQR 1.4.0; ISO lists 78. */
const BROKEN_V23_ALIGNMENT = "alignmentPatternCenters: [6, 30, 54, 74, 102]";

/** Correct centres for version 23 per ISO/IEC 18004 Annex E Table E.1. */
const FIXED_V23_ALIGNMENT = "alignmentPatternCenters: [6, 30, 54, 78, 102]";

/**
 * jsQR whose version-23 alignment table matches the standard, so a correct
 * encoder's version-23 symbols decode in the round-trip suite.
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
