/**
 * Minimal home page. Renders a sign-in form posting to the OAuth start action for
 * anonymous visitors, or a link into the app for signed-in ones. It exists as the
 * placeholder landing page until the marketing site is ported; every future
 * `requireUser` redirect also lands here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace HomeView {
	export interface Props {
		viewer: { name: string } | null;
		teamSlug: string | null;
	}
}

export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { viewer, teamSlug } = handle.props;

		return (
			<main mix={[s.page]}>
				<div mix={[s.emptyState]}>
					<h1>Uptime</h1>
					<p mix={[s.mutedSmall]}>Simple & reliable uptime monitoring for developers.</p>

					{viewer && teamSlug ? (
						<a href={routes.app.team.dashboard.href({ team: teamSlug })} mix={[s.buttonPrimary]}>
							Go to dashboard
						</a>
					) : (
						<form method="post" action={routes.auth.action.href()}>
							<button type="submit" mix={[s.buttonPrimary]}>
								Sign in
							</button>
						</form>
					)}
				</div>
			</main>
		);
	};
}
