/**
 * The rule a team logo follows: an absolute http(s) URL. The settings form enforces it on
 * save, and every place that draws a logo reads it through {@link teamLogoUrl}, so a row
 * saved before the rule existed renders the initials fallback instead of a broken image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Whether `value` parses as an absolute URL whose scheme a browser loads as an image. */
export function isHttpUrl(value: string): boolean {
	if (!URL.canParse(value)) return false;
	let { protocol } = new URL(value);
	return protocol === "https:" || protocol === "http:";
}

/**
 * The stored logo when it is an http(s) URL, and `null` for no logo or for legacy text,
 * so an `<img>` only ever receives a source it can load.
 *
 * @example
 * <Logo src={teamLogoUrl(team.logo)} name={team.name} />
 */
export function teamLogoUrl(logo: string | null): string | null {
	return logo !== null && isHttpUrl(logo) ? logo : null;
}
