/**
 * Sample-chapter view. Before the address is given it is the offer and its email field;
 * once on the list it is the chapter itself, as an article of prose, with a short-lived
 * link to the same chapter as an EPUB. Only the POST response renders the chapter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { media } from "@sdxc/u/responsive";
import { maxIs, mi, pb, pi } from "@sdxc/u/size";

import type { SubscribeForm } from "~/resources/components/subscribe-form";

import SampleChapterSection from "~/resources/components/sample-chapter-section";

/** The viewport width the chapter's own spacing and type step up at, matching the site's `lg`. */
const LARGE = "(min-width: 64rem)";

export namespace SampleView {
	export interface Props {
		/** Where the form posts. */
		action: string;
		/** The rendered chapter. Given only on the response that unlocks it. */
		chapter?: RemixNode;
		/** The signed, short-lived link to the chapter as an EPUB, minted with the unlock. */
		download?: string;
		/** A server-rendered error to show under the email field. */
		error?: string;
		/** The address a typo suggestion was just shown for, kept as typed on resubmit. */
		confirmEmail?: SubscribeForm.Props["confirmEmail"];
	}
}

/**
 * Renders either the sample-chapter offer or the unlocked chapter. Its
 * `prose` class reaches the markdown renderer's own elements, and the div
 * wraps the article the renderer already emits.
 */
export default function SampleView(handle: Handle<SampleView.Props>) {
	return () => {
		let { action, chapter, confirmEmail, download, error } = handle.props;

		if (chapter) {
			return (
				<div class="prose" mix={[mi("auto"), maxIs("65ch"), pi(5), pb(10), media(LARGE, pb(20))]}>
					{download && (
						<p>
							Prefer an e-reader?{" "}
							<a href={download} download="oauth2-handbook-sample.epub">
								Download this chapter as an EPUB
							</a>{" "}
							for Kindle, Kobo, Apple Books or any reading app. The link works for an hour.
						</p>
					)}
					{chapter}
				</div>
			);
		}

		return <SampleChapterSection action={action} confirmEmail={confirmEmail} error={error} />;
	};
}
