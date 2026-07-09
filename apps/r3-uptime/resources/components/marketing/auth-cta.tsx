/**
 * Primary marketing call-to-action: a link to the dashboard when signed in, or a
 * one-click sign-in form posting to the auth action otherwise. Every marketing hero
 * and final-CTA section repeats this exact `isSignedIn` branch, so it's centralized
 * here instead of duplicating the link/form pair per section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace AuthCta {
	export interface Props {
		isSignedIn: boolean;
		startLabel?: string;
		dashboardLabel?: string;
	}
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
		} = handle.props;

		if (isSignedIn) {
			return (
				<a href={routes.app.index.href()} mix={[s.buttonPrimary]}>
					{dashboardLabel}
				</a>
			);
		}

		return (
			<form method="post" action={routes.auth.action.href()}>
				<button type="submit" mix={[s.buttonPrimary]}>
					{startLabel}
				</button>
			</form>
		);
	};
}
