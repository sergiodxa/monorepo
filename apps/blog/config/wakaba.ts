/**
 * Wakaba's App Store listing and the colours the browser chrome paints around its pages.
 * Every call to download reads the listing from here, and its id also drives the Safari
 * smart banner; a `null` id renders every call as "Coming soon" instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Wakaba's App Store listing; `id` is the numeric Apple ID App Store Connect assigns. */
export interface AppStoreListing {
	id: string | null;
}

/**
 * The published App Store listing, which every download call links and the
 * `apple-itunes-app` smart banner names.
 */
export const APP_STORE: AppStoreListing = { id: "6831914175" };

/**
 * The listing's URL, or `null` until {@link APP_STORE} has an id.
 *
 * @param listing The listing to link, the configured one by default.
 * @returns The `apps.apple.com` URL of the listing.
 * @example appStoreUrl({ id: "6740000000" }) // "https://apps.apple.com/app/id6740000000"
 */
export function appStoreUrl(listing: AppStoreListing = APP_STORE): string | null {
	return listing.id ? `https://apps.apple.com/app/id${listing.id}` : null;
}

/**
 * The `theme-color` the browser tints its chrome with on Wakaba's pages: the app's cream
 * paper and warm charcoal, the same grounds `resources/css/wakaba.css` paints the pages on.
 */
export const WAKABA_THEME_COLORS = { light: "#F7F5ED", dark: "#1E1C19" } as const;
