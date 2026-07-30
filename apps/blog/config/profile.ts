/**
 * Defines the PROFILE constant holding Sergio's canonical site identity: display
 * name, bio summary, WebFinger resource, and X, GitHub, and YouTube profile URLs.
 * Centralizes these values so public routes and views share one source of truth.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Centralizes Sergio's canonical site and social profile URLs for public routes and views.
 */
export const PROFILE = {
	name: "Sergio Xalambrí",
	summary:
		"Web Developer from Buenos Aires with 10+ years of experience. I work at Daffy and maintain several open-source libraries around React Router and OAuth2.",

	canonical: {
		origin: "https://sergiodxa.com",
		resource: "acct:hello@sergiodxa.com",
	},

	x: {
		profile: "https://x.com/sergiodxa",
	},

	github: {
		profile: "https://github.com/sergiodxa",
		sponsor: "https://github.com/sponsors/sergiodxa",
		avatar: "https://github.com/sergiodxa.png",
	},

	youtube: {
		profile: "https://www.youtube.com/sergiodxa",
	},
} as const;
