/**
 * Auth failure view. Renders a short error message when the OAuth callback cannot
 * complete (provider error, expired transaction, invalid token). It exists so a
 * failed sign-in attempt gets a readable page instead of an unhandled error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace AuthErrorView {
	export interface Props {
		message: string;
	}
}

export default function AuthErrorView(handle: Handle<AuthErrorView.Props>) {
	return () => (
		<main mix={[s.page]}>
			<div mix={[s.emptyState]}>
				<h1>Sign-in failed</h1>
				<p mix={[s.mutedSmall]}>{handle.props.message}</p>
				<a href={routes.home.href()} mix={[s.link]}>
					Back home
				</a>
			</div>
		</main>
	);
}
