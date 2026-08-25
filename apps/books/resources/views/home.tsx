/**
 * Homepage view: the handbook's title, its one-paragraph pitch, and the
 * early-access email capture. Deliberately the whole page — a visitor who
 * lands here reads two sentences, then either subscribes or moves on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { vstack } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { is, maxIs, pb, pi } from "@pkg/u/size";
import { balance, font, leading, text, weight } from "@pkg/u/typography";

import type { SubscribeForm } from "~/resources/components/subscribe-form";

import SubscribeFormComponent from "~/resources/components/subscribe-form";

namespace HomeView {
	export interface Props {
		/** Where the subscribe form posts. */
		subscribeAction: string;
		/** UTM attribution carried through from this page's query string. */
		attribution: SubscribeForm.Props["attribution"];
		/** A server-rendered subscribe error, when the visitor just failed to subscribe. */
		error?: string;
	}
}

/** Renders the homepage. */
export default function HomeView(handle: Handle<HomeView.Props>) {
	return () => {
		let { attribution, error, subscribeAction } = handle.props;

		return (
			<div mix={[vstack({ gap: 10 }), is("100%"), maxIs("64rem"), pb(5)]}>
				<header mix={[vstack({ gap: 5 }), maxIs("65ch"), pi(5), font("serif")]}>
					<h1
						mix={[
							text("3xl"),
							leading("none"),
							weight("light"),
							balance(),
							media("(min-width: 64rem)", text("4xl")),
						]}
					>
						React Router OAuth2 Handbook
					</h1>

					<p mix={[text("lg")]}>
						A practical, modern guide to implementing{" "}
						<strong mix={[weight("semibold")]}>OAuth2 authentication</strong> in React Router and
						Remix apps—built on patterns you can apply to any web application.
					</p>
				</header>

				<SubscribeFormComponent
					action={subscribeAction}
					attribution={attribution}
					error={error}
					label="Email Address"
					submitLabel="Subscribe"
					title="Get early access & special pricing"
				/>
			</div>
		);
	};
}
