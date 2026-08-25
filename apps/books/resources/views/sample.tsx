/**
 * Sample-chapter view. Before the address is given it is the offer and its
 * email field; once on the list it is the chapter itself, rendered as an
 * article of prose. The chapter renders only as the POST response, so
 * reloading the page always shows the offer again.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { media } from "@pkg/u/responsive";
import { maxIs, mi, pb, pi } from "@pkg/u/size";

import type { SubscribeForm } from "~/resources/components/subscribe-form";

import SampleChapterSection from "~/resources/components/sample-chapter-section";

/** The viewport width the chapter's own spacing and type step up at, matching the site's `lg`. */
const LARGE = "(min-width: 64rem)";

export namespace SampleView {
	export interface Props {
		/** Where the form posts. */
		action: string;
		/** UTM attribution carried through from this page's query string. */
		attribution: SubscribeForm.Props["attribution"];
		/** The rendered chapter. Given only on the response that unlocks it. */
		chapter?: RemixNode;
		/** A server-rendered error to show under the email field. */
		error?: string;
	}
}

/**
 * Renders either the sample-chapter offer or the unlocked chapter. Its
 * `prose` class reaches the markdown renderer's own elements, and the div
 * wraps the article the renderer already emits.
 */
export default function SampleView(handle: Handle<SampleView.Props>) {
	return () => {
		let { action, attribution, chapter, error } = handle.props;

		if (chapter) {
			return (
				<div class="prose" mix={[mi("auto"), maxIs("65ch"), pi(5), pb(10), media(LARGE, pb(20))]}>
					{chapter}
				</div>
			);
		}

		return <SampleChapterSection action={action} attribution={attribution} error={error} />;
	};
}
