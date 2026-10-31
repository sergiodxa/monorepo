/**
 * The free chapter's gate: the offer and its email field beside the chapter's first page.
 * It is the whole of the book's sample page until an address unlocks the chapter itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { FeatureBand } from "@sdxc/ui/patterns";

import type { BookCopy } from "~/resources/content/books";

import SamplePage from "~/resources/views/book/sample-page";
import EmailForm from "~/resources/views/site/email-form";

export namespace SampleOffer {
	export interface Props {
		copy: BookCopy;
		/** Where the form posts: the same URL, which answers with the chapter. */
		action: string;
		/** A server-rendered error to show under the field. */
		error?: string;
		/** The address a typo suggestion was just shown for, kept as typed on resubmit. */
		confirmEmail?: string;
	}
}

/**
 * Renders the page's `<main>` as one split band whose title is the page's `h1`.
 *
 * @param handle Runtime handle carrying the copy, endpoint and form state.
 * @returns The render function producing the page's main content.
 */
export default function SampleOffer(handle: Handle<SampleOffer.Props>) {
	return () => {
		let { action, confirmEmail, copy, error } = handle.props;

		return (
			<main>
				<FeatureBand
					id="sample"
					layout="split"
					level={1}
					spacing="hero"
					eyebrow="Free chapter"
					title={`Read “${copy.sample.page.title}” free`}
					description={copy.sample.description}
					media={<SamplePage page={copy.sample.page} />}
				>
					<EmailForm
						action={action}
						error={error}
						confirmEmail={confirmEmail}
						submitLabel="Read the chapter"
						note="No spam. Unsubscribe anytime."
					/>
				</FeatureBand>
			</main>
		);
	};
}
