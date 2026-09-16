/**
 * The standalone, non-session cookies the HTTP layer reads and writes. They live outside
 * the session because both must survive a request that has no session yet: the sign-in
 * redirect leaves the origin entirely, and a language is resolved before anybody is known.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCookie } from "remix/cookie";
import * as s from "remix/data-schema";

import type { ReadingFace, Theme } from "~/database/schema";

import { DEFAULT_READING_FACE, DEFAULT_THEME, READING_FACES, THEMES } from "~/database/schema";

/** How a page is painted: the scheme it is in, and the face its reading surfaces take. */
export interface Presentation {
	theme: Theme;
	face: ReadingFace;
}

/**
 * Remembers the page an anonymous visitor was trying to reach, so the auth callback lands
 * them there. Left unsigned: the value is narrowed to a same-origin relative path before
 * use, so tampering can only redirect within this app.
 */
export const RETURN_TO_COOKIE = createCookie("reader:return-to", {
	path: "/",
	maxAge: 60 * 5,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});

/** Remembers the visitor's chosen interface language for a year. */
export const LANGUAGE_COOKIE = createCookie("reader:language", {
	path: "/",
	maxAge: 60 * 60 * 24 * 365,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});

/**
 * Remembers how the reader's pages are painted, so the answer is an input to the first
 * render rather than a correction applied after it. A preference read in the browser
 * arrives once the document has already been painted in whatever the markup said, which is
 * a reader who chose dark watching a white page turn dark on every navigation.
 *
 * A cookie as well as the stored row, because the document shell renders for pages with no
 * other reason to touch a reader's storage — the 404 handler, the sign-in page — and waking
 * a Durable Object on the critical path of a page to decide a class is the wrong cost in
 * the wrong place.
 *
 * Left unsigned, for {@link RETURN_TO_COOKIE}'s reason: the worst a tampered value achieves
 * is rendering the reader's own page in a scheme they did not pick.
 */
export const PRESENTATION_COOKIE = createCookie("reader:presentation", {
	path: "/",
	maxAge: 60 * 60 * 24 * 365,
	httpOnly: true,
	sameSite: "Lax",
	secure: import.meta.env.PROD,
});

/**
 * What {@link PRESENTATION_COOKIE} carries, narrowed so an unrecognized value falls back to
 * the defaults rather than reaching a template. Both fields are optional in the parse and
 * defaulted out of it, so a cookie written by an older version of this app is read as far
 * as it goes.
 */
export const PresentationCookie = s.object({
	theme: s.defaulted(s.enum_(THEMES), DEFAULT_THEME),
	face: s.defaulted(s.enum_(READING_FACES), DEFAULT_READING_FACE),
});

/**
 * How a page is painted, as the cookie and the stored row both answer it.
 *
 * @param value - Whatever {@link PRESENTATION_COOKIE} parsed out of the request, which is
 * `undefined` for a browser carrying none and anything at all for a tampered one.
 * @example let { theme, face } = readPresentation(await PRESENTATION_COOKIE.parse(header));
 */
export function readPresentation(value: unknown): Presentation {
	let parsed = s.parseSafe(PresentationCookie, decoded(value));
	return parsed.success ? parsed.value : { theme: DEFAULT_THEME, face: DEFAULT_READING_FACE };
}

/**
 * The cookie's text read back as whatever it holds. A cookie carries a string, so the
 * object goes in as JSON and comes out as anything at all — including text that is not
 * JSON, which is `undefined` here and the defaults above.
 */
function decoded(value: unknown): unknown {
	if (typeof value !== "string") return undefined;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return undefined;
	}
}

/**
 * The `Set-Cookie` header that carries how a reader's pages are painted, for the two
 * responses that write it: the one that stores a submitted answer, and the sign-in that
 * puts the stored one onto a browser that has none.
 *
 * @param value - The answer to carry, which is what the object holds rather than what a
 * form submitted.
 */
export function writePresentation(value: Presentation): Promise<string> {
	return PRESENTATION_COOKIE.serialize(JSON.stringify(value));
}
