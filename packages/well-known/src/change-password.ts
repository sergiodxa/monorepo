/**
 * The W3C well-known URL for changing passwords: a redirect a password manager
 * follows to the page where a signed-in person changes their password. The name
 * serves no document, only the redirect.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const NAME = "change-password";

/**
 * A 302 to the page where a signed-in person changes their password. A relative
 * target stays relative in `Location`, which the client resolves against the
 * well-known URL's origin.
 *
 * @param target - The change-password page.
 * @example
 * wellKnown({ "change-password": () => redirect("/account/password") });
 */
export function redirect(target: URL | string): Response {
	return new Response(null, { status: 302, headers: { Location: String(target) } });
}
