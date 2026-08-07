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

import { css } from "remix/ui";

import { DOCUMENT, THEME } from "~/resources/styles";

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

/** Renders the hidden logout iframes and the meta-refresh that follows them. */
export default function LogoutFrontchannelView(handle: Handle<LogoutFrontchannelView.Setup>) {
	return () => {
		let { documentTitle, title, signingOut, redirecting, continueLabel, urls, redirectUri } =
			handle.props;

		return (
			<html lang="en" mix={[THEME, DOCUMENT]}>
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<meta httpEquiv="refresh" content={`${REDIRECT_DELAY_SECONDS};url=${redirectUri}`} />
					<title>{documentTitle}</title>
				</head>
				<body>
					<main
						mix={css({
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "1.5rem",
							margin: "0 auto",
							maxWidth: "40rem",
							padding: "2.5rem 1rem",
							color: "var(--ui-color-neutral-900)",
							textAlign: "center",
							"@media (prefers-color-scheme: dark)": {
								color: "var(--ui-color-neutral-50)",
							},
						})}
					>
						<h1 mix={css({ fontSize: "1.875rem", fontWeight: "700" })}>{title}</h1>
						<p mix={css({ color: "var(--ui-color-neutral-600)" })}>{signingOut}</p>
						<p mix={css({ color: "var(--ui-color-neutral-600)" })}>{redirecting}</p>

						<noscript>
							<a href={redirectUri} mix={css({ color: "var(--ui-color-brand-600)" })}>
								{continueLabel}
							</a>
						</noscript>
					</main>

					{/* Loaded, not displayed: each relying party clears its own session when
					    its logout URI is fetched, and nothing here reads the result. */}
					<div mix={css({ display: "none" })}>
						{urls.map((entry) => (
							<iframe
								key={entry.clientId}
								src={entry.url}
								title={entry.clientId}
								sandbox="allow-scripts allow-same-origin"
							/>
						))}
					</div>
				</body>
			</html>
		);
	};
}
