/**
 * Upgrade view: the pitch for moving from the single book to the Complete Package, and
 * the email field that resolves the reader's existing purchase. It asks for an address
 * rather than a login because the only record of the purchase lives in Polar.
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

/** The viewport width the heading steps up a size at, matching the site's `lg`. */
const LARGE = "(min-width: 64rem)";

/** The one paragraph of copy, kept as a string so its quoted package names read as text. */
const PITCH =
	'Upgrade from "The Book" to get the "Complete Package" and access all the content, including the sample application, and access to the Discord community.';

namespace UpgradeView {
	export interface Props {
		/** Where the upgrade form posts. */
		action: string;
		/** UTM attribution carried through from this page's query string. */
		attribution: SubscribeForm.Props["attribution"];
		/** A server-rendered validation error, when the visitor just submitted a bad address. */
		error?: string;
	}
}

/** Renders the upgrade page. */
export default function UpgradeView(handle: Handle<UpgradeView.Props>) {
	return () => {
		let { action, attribution, error } = handle.props;

		return (
			<section mix={[vstack({ gap: 10 }), is("100%"), maxIs("64rem"), pb(5)]}>
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
						Upgrade to the Complete Package
					</h2>

					<p mix={[maxIs("65ch"), balance()]}>{PITCH}</p>
				</header>

				<SubscribeFormComponent
					action={action}
					attribution={attribution}
					error={error}
					label="Email address"
					reassurance={false}
					submitLabel="Get Upgrade Link"
				/>
			</section>
		);
	};
}
