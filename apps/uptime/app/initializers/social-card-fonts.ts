/**
 * The faces social cards are set in, Inter and JetBrains Mono (both SIL OFL), standing in for
 * the product's system sans and mono. They ship in the Worker as data modules and parse on the
 * first card an isolate renders, since parsing at module scope runs during startup validation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FontError } from "@sdxc/font";
import type { Result } from "@sdxc/result";

import { parseFont } from "@sdxc/font";
import { isFailure, success } from "@sdxc/result";

import type { SocialCardImage } from "~/app/services/social-card-image";

import INTER_REGULAR from "~/resources/fonts/inter-regular.ttf.bin";
import INTER_SEMIBOLD from "~/resources/fonts/inter-semibold.ttf.bin";
import JETBRAINS_MONO_REGULAR from "~/resources/fonts/jetbrains-mono-regular.ttf.bin";

/** The parsed faces, kept for the isolate's lifetime once the first card asks. */
let parsed: Result<SocialCardImage.Fonts, FontError> | undefined;

/** The card faces, parsed once per isolate. A bundled font that fails to parse is a failure. */
export function socialCardFonts(): Result<SocialCardImage.Fonts, FontError> {
	parsed ??= parseAll();
	return parsed;
}

/** Parses every bundled face, stopping at the first that fails. */
function parseAll(): Result<SocialCardImage.Fonts, FontError> {
	let regular = parseFont(INTER_REGULAR);
	if (isFailure(regular)) return regular;
	let semibold = parseFont(INTER_SEMIBOLD);
	if (isFailure(semibold)) return semibold;
	let mono = parseFont(JETBRAINS_MONO_REGULAR);
	if (isFailure(mono)) return mono;
	return success({ regular: regular.data, semibold: semibold.data, mono: mono.data });
}
