/**
 * Sample-chapter view. Before the address is given it is the offer and its email field;
 * once the visitor is on the list it is the chapter itself, set as an article of prose.
 *
 * The chapter is deliberately not persisted: it is rendered as the response to the POST and
 * nowhere else, so reloading the page shows the offer again. That is the gate working, not
 * a bug — there is no session or cookie behind it.
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

/** Renders either the sample-chapter offer or the unlocked chapter. */
export default function SampleView(handle: Handle<SampleView.Props>) {
	return () => {
		let { action, attribution, chapter, error } = handle.props;

		if (chapter) {
			/* `prose` carries the chapter's typographic rhythm — measure, leading, and the
			space between blocks — which a Markdown body needs and no other page here does. It
			is a stylesheet rather than mixins because the elements being styled are produced
			by the Markdown renderer, not written at this call site.

			A plain wrapper, not an `<article>`: the renderer already emits one around the
			document, and nesting a second would claim the chapter is two articles. */
			return (
				<div class="prose" mix={[mi("auto"), maxIs("65ch"), pi(5), pb(10), media(LARGE, pb(20))]}>
					{chapter}
				</div>
			);
		}

		return <SampleChapterSection action={action} attribution={attribution} error={error} />;
	};
}
