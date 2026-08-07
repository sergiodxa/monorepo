/**
 * The OpenID Connect Front-Channel Logout 1.0 page: one hidden iframe per relying party
 * that registered a front-channel logout URI, given a moment to load before the browser
 * moves on to the post-logout destination.
 *
 * The follow-up navigation is a `<meta http-equiv="refresh">` rather than a timer in
 * script, so the page ships no JavaScript at all and still behaves the same. The
 * `<noscript>` link is kept as the manual way out for anything that ignores the refresh.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card, Link, Text } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, hidden, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";

import DocumentLayout from "~/resources/layouts/document";

/**
 * Seconds the iframes are given to reach their relying parties before the browser
 * navigates away. Front-channel logout has no completion signal, so this is a deadline
 * rather than a wait: the person's own logout must not hang on somebody else's server.
 */
const REDIRECT_DELAY_SECONDS = 2;

namespace LogoutFrontchannelView {
	export interface Setup {
		/** Document title, translated by the caller. */
		documentTitle: string;
		/** Heading above the progress copy. */
		title: string;
		/** Sentence explaining that other applications are being signed out of. */
		signingOut: string;
		/** Short status line shown while the redirect is pending. */
		redirecting: string;
		/** Label of the manual link offered when the refresh does not happen. */
		continueLabel: string;
		/** One entry per relying party to notify, already built by the caller. */
		urls: Array<{ clientId: string; url: string }>;
		/** Where the browser goes once the iframes have had their moment. */
		redirectUri: string;
	}
}

/**
 * Renders the hidden logout iframes and the meta-refresh that follows them.
 *
 * `clientRuntime={false}` is what keeps this page's zero-JavaScript contract while it
 * still composes the shared document: the layout emits neither the module script nor the
 * `modulepreload` hint, so nothing here can start executing in a relying party's flow.
 */
export default function LogoutFrontchannelView(handle: Handle<LogoutFrontchannelView.Setup>) {
	return () => {
		let { documentTitle, title, signingOut, redirecting, continueLabel, urls, redirectUri } =
			handle.props;

		return (
			<DocumentLayout
				title={documentTitle}
				clientRuntime={false}
				head={<meta httpEquiv="refresh" content={`${REDIRECT_DELAY_SECONDS};url=${redirectUri}`} />}
			>
				<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
					<Card mix={[is("100%"), maxIs("22.5rem")]}>
						<Card.Header mix={[textAlign("center")]}>
							<Card.Title>{title}</Card.Title>
							<Card.Description>{signingOut}</Card.Description>
						</Card.Header>

						<Card.Content mix={[flex(), flexCol(), gap(2), textAlign("center")]}>
							<Text mix={[fg("neutral.muted")]}>{redirecting}</Text>

							<noscript>
								<Link href={redirectUri}>{continueLabel}</Link>
							</noscript>
						</Card.Content>
					</Card>
				</main>

				{/* Loaded, not displayed: each relying party clears its own session when
				    its logout URI is fetched, and nothing here reads the result. */}
				<div mix={[hidden()]}>
					{urls.map((entry) => (
						<iframe
							key={entry.clientId}
							src={entry.url}
							title={entry.clientId}
							sandbox="allow-scripts allow-same-origin"
						/>
					))}
				</div>
			</DocumentLayout>
		);
	};
}
