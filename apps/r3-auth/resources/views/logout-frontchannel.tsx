/**
 * The OpenID Connect Front-Channel Logout 1.0 page: one hidden iframe per relying party
 * that registered a front-channel logout URI, given a moment to load before the browser
 * moves on to the post-logout destination.
 *
 * The follow-up navigation runs through a `<meta http-equiv="refresh">` tag, keeping
 * the page pure markup end to end. The `<noscript>` link stands by as the manual way
 * out for anything that ignores the refresh.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flex, flexCol, gap, hidden, items, justify } from "@sdxc/u/layout";
import { is, maxIs, minBs, p } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Card, Link, Text } from "@sdxc/ui";

import DocumentLayout from "~/resources/layouts/document";

/**
 * Seconds the iframes are given to reach their relying parties before the browser
 * navigates away. This fixed deadline keeps the person's own logout moving even when
 * somebody else's server is slow.
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
		/** Label of the manual link shown as the no-refresh fallback. */
		continueLabel: string;
		/** One entry per relying party to notify, already built by the caller. */
		urls: Array<{ clientId: string; url: string }>;
		/** Where the browser goes once the iframes have had their moment. */
		redirectUri: string;
	}
}

/**
 * Renders the hidden logout iframes and the meta-refresh that follows them. Firing
 * each iframe's fetch is enough to sign its relying party out; `clientRuntime={false}`
 * keeps this page's zero-JavaScript contract.
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
