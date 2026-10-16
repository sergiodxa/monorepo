/**
 * The serif social cards are set in, Source Serif 4 (SIL OFL), bundled into the Worker as
 * data modules and parsed on the first card an isolate renders. Parsing at module scope
 * would run during the deploy's startup validation, so it waits for a call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FontError } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";
import { isFailure, success } from "@sdxc/result";

import type { SocialCardImage } from "~/app/services/social-card-image";

import SERIF_REGULAR from "~/resources/fonts/source-serif-4-regular.ttf.bin";
import SERIF_SEMIBOLD from "~/resources/fonts/source-serif-4-semibold.ttf.bin";

/** The parsed faces, kept for the isolate's lifetime once the first card asks. */
let parsed: Result<SocialCardImage.Fonts, FontError> | undefined;

/** The card faces, parsed once per isolate. A bundled font that fails to parse is a failure. */
export function socialCardFonts(): Result<SocialCardImage.Fonts, FontError> {
	parsed ??= parseAll();
	return parsed;
}

/** Parses both bundled weights, stopping at the first that fails. */
function parseAll(): Result<SocialCardImage.Fonts, FontError> {
	let regular = parseFont(SERIF_REGULAR);
	if (isFailure(regular)) return regular;
	let semibold = parseFont(SERIF_SEMIBOLD);
	if (isFailure(semibold)) return semibold;
	return success({ regular: regular.data, semibold: semibold.data });
}
