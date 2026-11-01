/**
 * The homepage: the featured book's cover beside its pitch and the newsletter sign-up.
 * The first screen is the form and nothing else; a new subscriber is sent on to the book.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { FeatureBand } from "@sdxc/ui/landing";

import type { BookCopy } from "~/resources/content/books";

import EmailForm from "~/resources/views/site/email-form";

namespace HomeView {
	export interface Props {
		/** The featured book's title, set as the page's `h1`. */
		title: string;
		copy: BookCopy;
		/** Where the subscribe form posts. */
		subscribeAction: string;
		/** A server-rendered subscribe error, when the visitor just failed to subscribe. */
		error?: string;
		/** The address a typo suggestion was just shown for, kept as typed on resubmit. */
		confirmEmail?: string;
	}
}

/**
 * Renders the page's `<main>` as one split band, centred in the window's height so the
 * offer reads as a title page.
 *
 * @param handle Runtime handle carrying the book, endpoint and form state.
 * @returns The render function producing the page's main content.
 */
export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { confirmEmail, copy, error, subscribeAction, title } = handle.props;
		let Cover = copy.Cover;

		return (
			<main mix={[raw({ flex: "1", display: "grid", alignContent: "center" })]}>
				<FeatureBand
					id="subscribe"
					layout="split"
					level={1}
					spacing="hero"
					eyebrow="Out now"
					title={title}
					description={copy.hero.description}
					media={<Cover />}
				>
					<EmailForm
						action={subscribeAction}
						error={error}
						confirmEmail={confirmEmail}
						submitLabel="Subscribe"
						note="No spam. Unsubscribe anytime."
					/>
				</FeatureBand>
			</main>
		);
	};
}
