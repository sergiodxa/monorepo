/**
 * Wakaba's App Store listing and the colours the browser chrome paints around its pages.
 * The listing is unpublished until launch: every call to download reads it from here, so
 * setting the id once turns the "coming soon" state into a link and enables the smart banner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Wakaba's App Store listing; `id` is the numeric Apple ID App Store Connect assigns. */
export interface AppStoreListing {
	id: string | null;
}

/**
 * The App Store listing. `null` while the app awaits release, which renders every download
 * call as "Coming soon to the App Store" and leaves out the `apple-itunes-app` banner.
 */
export const APP_STORE: AppStoreListing = { id: null };

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
