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
