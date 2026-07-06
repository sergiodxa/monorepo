/**
 * Defines the transactional email body sent when someone is invited to a team,
 * rendering a short message naming the team and an "Accept Invite" link built from
 * the provided URL. It exists so the invite flow can render a consistent email using
 * the app's email templating.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export function TeamInviteEmail(props: { team: string; url: URL }) {
	return (
		<>
			<p>
				You have been invited to join {props.team} on Uptime. Click the link below to accept the
				invite and join the team.
			</p>

			<p>
				<a href={props.url.toString()}>Accept Invite</a>
			</p>
		</>
	);
}
