/**
 * The free-sample offer: a heading, one line of copy, and the email field that unlocks the
 * chapter. It is rendered both as a section of the sales page and as the whole of the
 * sample page, so the offer reads identically wherever a visitor meets it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { vstack } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { is, maxIs, pb, pi } from "@pkg/u/size";
import { balance, font, leading, text, textTransform, weight } from "@pkg/u/typography";

import type { SubscribeForm } from "~/resources/components/subscribe-form";

import SubscribeFormComponent from "~/resources/components/subscribe-form";
import { SAMPLE } from "~/resources/content/release";

/** The viewport width the heading steps up a size at, matching the site's `lg`. */
const LARGE = "(min-width: 64rem)";

export namespace SampleChapterSection {
	export interface Props {
		/** Where the form posts — the sample page unlocks the chapter on POST. */
		action: string;
		/** UTM attribution carried through from the page's query string. */
		attribution: SubscribeForm.Props["attribution"];
		/** A server-rendered error to show under the field. */
		error?: string;
	}
}

/**
 * The `sample` id is load-bearing: it is the anchor external links point at.
 */
export default function SampleChapterSection(handle: Handle<SampleChapterSection.Props>) {
	return () => {
		let { action, attribution, error } = handle.props;

		return (
			<section id="sample" mix={[vstack({ gap: 10 }), is("100%"), maxIs("64rem"), pb(5)]}>
				<header mix={[vstack({ gap: 2.5 }), pi(5)]}>
					<h2
						mix={[
							font("serif"),
							text("3xl"),
							leading("none"),
							weight("light"),
							balance(),
							textTransform("capitalize"),
							media(LARGE, text("4xl")),
						]}
					>
						{SAMPLE.title}
					</h2>

					<p mix={[maxIs("65ch"), balance()]}>{SAMPLE.description}</p>
				</header>

				<SubscribeFormComponent
					action={action}
					attribution={attribution}
					error={error}
					label="Email address"
					submitLabel={SAMPLE.submitLabel}
				/>
			</section>
		);
	};
}
