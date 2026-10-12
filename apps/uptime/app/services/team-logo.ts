/**
 * The rule a team logo follows: an absolute `https://` URL. The settings form and the API
 * enforce it on save, and every place that draws a logo reads it through {@link teamLogoUrl},
 * so a row saved before the rule existed renders the initials fallback instead of an image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Whether `value` is an absolute URL spelled with the `https://` prefix, the same test the
 * API's `^https://` pattern plus URL format applies, so the form and the API agree.
 */
export function isHttpsUrl(value: string): boolean {
	return value.startsWith("https://") && URL.canParse(value);
}

/**
 * The stored logo when it is an https URL, and `null` for no logo or for a legacy value
 * (free text, `http:`), so an `<img>` only ever receives a secure source it can load.
 *
 * @example
 * <Logo src={teamLogoUrl(team.logo)} name={team.name} />
 */
export function teamLogoUrl(logo: string | null): string | null {
	return logo !== null && isHttpsUrl(logo) ? logo : null;
}
