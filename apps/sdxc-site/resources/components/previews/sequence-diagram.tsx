/**
 * Live preview for `SequenceDiagram`: a PKCE sign-in between the browser, the app and its
 * authorization server, each message drawn in order before the outcome settles and loops.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { KeyRoundIcon, LockIcon, MonitorIcon, ServerIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { SequenceDiagram } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<SequenceDiagram
	aria-label="A PKCE sign-in, message by message"
	pauseLabel="Pause the animation"
	actors={[
		{ name: "Browser", icon: <MonitorIcon size={14} aria-hidden="true" /> },
		{ name: "Your app", icon: <ServerIcon size={14} aria-hidden="true" /> },
		{ name: "Authorization Server", icon: <KeyRoundIcon size={14} aria-hidden="true" /> },
	]}
	messages={[
		{ from: 0, to: 1, label: "Open the sign-in page", code: "GET /login" },
		{ from: 1, to: 1, label: "Make a code verifier" },
		{ from: 1, to: 0, label: "Redirect with its challenge", code: "302 /authorize" },
		{ from: 0, to: 2, label: "Sign in and consent" },
		{ from: 2, to: 1, label: "Return a one-time code", code: "GET /callback?code=…" },
		{ from: 1, to: 2, label: "Trade code and verifier", code: "POST /token" },
		{ from: 2, to: 1, label: "Issue the tokens" },
	]}
	outcome="Signed in"
	footnote={
		<>
			<LockIcon size={14} aria-hidden="true" />
			No client secret in the browser
		</>
	}
/>`;

/** What the preview registry reads: the source to show, and the diagram to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "36rem", marginInline: "auto" })]}>
			<SequenceDiagram
				aria-label="A PKCE sign-in, message by message"
				pauseLabel="Pause the animation"
				actors={[
					{ name: "Browser", icon: <MonitorIcon size={14} aria-hidden="true" /> },
					{ name: "Your app", icon: <ServerIcon size={14} aria-hidden="true" /> },
					{ name: "Authorization Server", icon: <KeyRoundIcon size={14} aria-hidden="true" /> },
				]}
				messages={[
					{ from: 0, to: 1, label: "Open the sign-in page", code: "GET /login" },
					{ from: 1, to: 1, label: "Make a code verifier" },
					{ from: 1, to: 0, label: "Redirect with its challenge", code: "302 /authorize" },
					{ from: 0, to: 2, label: "Sign in and consent" },
					{ from: 2, to: 1, label: "Return a one-time code", code: "GET /callback?code=…" },
					{ from: 1, to: 2, label: "Trade code and verifier", code: "POST /token" },
					{ from: 2, to: 1, label: "Issue the tokens" },
				]}
				outcome="Signed in"
				footnote={
					<>
						<LockIcon size={14} aria-hidden="true" />
						No client secret in the browser
					</>
				}
			/>
		</div>
	),
};
