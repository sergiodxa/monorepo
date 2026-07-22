/**
 * Primary marketing call-to-action: a link to the dashboard when signed in, or a
 * one-click sign-in form posting to the auth action otherwise. Every marketing hero
 * and final-CTA section repeats this exact `isSignedIn` branch, so it's centralized
 * here instead of duplicating the link/form pair per section. Renders through the
 * shared `Button`/`LinkButton` components (themselves thin wrappers over
 * `@pkg/r3-ui`'s own) instead of a hand-rolled "solid primary" style, so this CTA
 * never drifts from every other button in the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import type { ButtonSize } from "~/resources/components/button";

import Button from "~/resources/components/button";
import LinkButton from "~/resources/components/link-button";
import routes from "~/routes/web";

namespace AuthCta {
	export interface Props {
		isSignedIn: boolean;
		/**
		 * Label for the signed-out state's submit button. Required rather than
		 * defaulted — an English fallback here would silently leak into every
		 * non-English locale, so every call site must pass its own translated
		 * copy (e.g. `ctx.i18next.t("landing.hero.cta.out")`).
		 */
		startLabel: string;
		/**
		 * Label for the signed-in state's dashboard link. Required for the same
		 * reason as {@link AuthCta.Props.startLabel}.
		 */
		dashboardLabel: string;
		/**
		 * `"lg"` (default) for hero/final-CTA placements, `"sm"` for the sticky
		 * marketing header, and `"docs"` for the docs topbar — `"docs"` renders
		 * at the same `"sm"` button size, just with its own placement context.
		 */
		size?: "sm" | "lg" | "docs";
		/** Optional trailing icon (e.g. an arrow), rendered after the label. */
		icon?: RemixNode;
	}
}

/** Maps {@link AuthCta.Props.size} onto the shared `Button`/`LinkButton` size scale — `"docs"` reuses `"sm"`. */
function resolveButtonSize(size: "sm" | "lg" | "docs"): ButtonSize {
	return size === "lg" ? "lg" : "sm";
}

/**
 * Renders {@link AuthCta.Props.dashboardLabel} linking to the app when signed in,
 * otherwise a submit button reading {@link AuthCta.Props.startLabel} that posts to
 * the auth action.
 */
export default function AuthCta(handle: Handle<AuthCta.Props>) {
	return () => {
		let { isSignedIn, startLabel, dashboardLabel, size = "lg", icon } = handle.props;
		let buttonSize = resolveButtonSize(size);

		if (isSignedIn) {
			return (
				<LinkButton
					href={routes.app.index.href()}
					color="primary"
					variant="solid"
					size={buttonSize}
				>
					{dashboardLabel}
					{icon}
				</LinkButton>
			);
		}

		return (
			<form method="post" action={routes.auth.action.href()}>
				<Button type="submit" color="primary" variant="solid" size={buttonSize}>
					{startLabel}
					{icon}
				</Button>
			</form>
		);
	};
}
