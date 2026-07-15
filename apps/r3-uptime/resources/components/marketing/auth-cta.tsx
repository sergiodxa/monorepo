/**
 * Primary marketing call-to-action: a link to the dashboard when signed in, or a
 * one-click sign-in form posting to the auth action otherwise. Every marketing hero
 * and final-CTA section repeats this exact `isSignedIn` branch, so it's centralized
 * here instead of duplicating the link/form pair per section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import routes from "~/routes/web";

/** Primary (brand) scale shades used on this button, hue 142. */
const primary = { 600: "oklch(0.6 0.16 142)", 700: "oklch(0.5 0.14 142)" };

namespace AuthCta {
	export interface Props {
		isSignedIn: boolean;
		startLabel?: string;
		dashboardLabel?: string;
		/**
		 * `"lg"` (default) for hero/final-CTA placements; `"sm"` for the sticky
		 * header and docs topbar, which use smaller padding, font size, and
		 * font weight than the hero/final-CTA's larger button.
		 */
		size?: "sm" | "lg";
		/** Optional trailing icon (e.g. an arrow), rendered after the label. */
		icon?: RemixNode;
	}
}

/**
 * Builds the primary marketing CTA button for a given size (only used here,
 * so no `styles.ts` export is needed).
 */
function primaryButtonStyle(size: "sm" | "lg") {
	let isLarge = size === "lg";

	return css({
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: 6,
		padding: isLarge ? "12px 24px" : "8px 16px",
		borderRadius: 8,
		border: "1px solid transparent",
		background: primary[600],
		color: "#ffffff",
		fontFamily: "inherit",
		fontSize: isLarge ? "1rem" : "0.875rem",
		fontWeight: isLarge ? 600 : 500,
		cursor: "pointer",
		boxShadow: isLarge
			? "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)"
			: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
		"&:hover": {
			background: primary[700],
			boxShadow: isLarge
				? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
				: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
		},
	});
}

/**
 * Renders {@link AuthCta.Props.dashboardLabel} (default "Go to dashboard") linking to
 * the app when signed in, otherwise a submit button reading
 * {@link AuthCta.Props.startLabel} (default "Start Monitoring") that posts to the
 * auth action.
 */
export default function AuthCta(handle: Handle<AuthCta.Props>) {
	return () => {
		let {
			isSignedIn,
			startLabel = "Start Monitoring",
			dashboardLabel = "Go to dashboard",
			size = "lg",
			icon,
		} = handle.props;
		let buttonMix = primaryButtonStyle(size);

		if (isSignedIn) {
			return (
				<a href={routes.app.index.href()} mix={[buttonMix]}>
					{dashboardLabel}
					{icon}
				</a>
			);
		}

		return (
			<form method="post" action={routes.auth.action.href()}>
				<button type="submit" mix={[buttonMix]}>
					{startLabel}
					{icon}
				</button>
			</form>
		);
	};
}
