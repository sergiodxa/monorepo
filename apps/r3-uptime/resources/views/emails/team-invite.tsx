/**
 * Team-invite email body. Rendered to an HTML string (not served as a page) and
 * passed to Resend's `html` field — kept intentionally minimal, just a plain
 * two-paragraph message with the accept link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

namespace TeamInviteEmail {
	export interface Props {
		team: string;
		url: string;
	}
}

/** Renders the invite email body with the team name and the accept `url`. */
export default function TeamInviteEmail(handle: Handle<TeamInviteEmail.Props>) {
	return () => {
		let { team, url } = handle.props;

		return (
			<div>
				<p>You've been invited to join {team} on Uptime.</p>
				<p>
					<a href={url}>Accept Invite</a>
				</p>
			</div>
		);
	};
}
