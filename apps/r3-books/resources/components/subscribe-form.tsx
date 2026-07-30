/**
 * The email-capture form shared by every page that collects an address: an optional
 * heading, one email field with a submit button beside it, the reassurance line, and a
 * server-rendered error slot.
 *
 * It is a plain `<form method="post">` with native constraint validation. There is no
 * submit spinner or disabled state — the browser's own progress indication covers a
 * document navigation, and adding them back would mean shipping this site's only
 * client-side JavaScript for a progress bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, fg } from "@pkg/u/color";
import { raw } from "@pkg/u/general";
import { hstack, shrink, vstack } from "@pkg/u/layout";
import { dark, media } from "@pkg/u/responsive";
import { is, maxIs, pb, pi } from "@pkg/u/size";
import { focusVisible, placeholder, when } from "@pkg/u/state";
import { pretty, text, weight, whiteSpace } from "@pkg/u/typography";
import { css } from "remix/ui";

/** The viewport width the field and button stop stacking at, matching the site's `lg`. */
const SIDE_BY_SIDE = "(min-width: 64rem)";

export namespace SubscribeForm {
	export interface Props {
		/** Where the form posts. */
		action: string;
		/** The submit button's label. */
		submitLabel: string;
		/** Optional heading rendered above the field. */
		title?: string;
		/** Accessible label for the email field. Visually hidden, like the original. */
		label?: string;
		/**
		 * UTM attribution to carry through as hidden fields, read from the query string of
		 * the page this form is rendered on. Attribution is preserved across the redirect
		 * to the subscriber's destination this way.
		 */
		attribution?: {
			source?: string;
			campaign?: string;
			medium?: string;
			referral?: string;
		};
		/** A server-rendered error to show under the field, replacing the client-side one. */
		error?: string;
	}
}

/** Renders the email-capture form. */
export default function SubscribeForm(handle: Handle<SubscribeForm.Props>) {
	return () => {
		let {
			action,
			attribution = {},
			error,
			label = "Email address",
			submitLabel,
			title,
		} = handle.props;

		return (
			<form method="post" action={action} mix={[vstack({ gap: 2.5 }), is("100%"), maxIs("36rem")]}>
				<input type="hidden" name="source" value={attribution.source ?? ""} />
				<input type="hidden" name="campaign" value={attribution.campaign ?? ""} />
				<input type="hidden" name="medium" value={attribution.medium ?? ""} />
				<input type="hidden" name="referral" value={attribution.referral ?? ""} />

				{title && <h2 mix={[pi(5), text("base"), weight("semibold")]}>{title}</h2>}

				{/* Stacked on a phone, side by side from `lg` up, where the field grows and the
				button keeps its intrinsic width. */}
				<div
					mix={[
						vstack({ gap: 2.5, align: "stretch" }),
						pi(5),
						media(SIDE_BY_SIDE, [hstack({ gap: 2.5, align: "stretch" }), pi(0)]),
					]}
				>
					<div mix={[is("100%")]}>
						<label for="email" mix={[visuallyHidden()]}>
							{label}
						</label>
						{/* Native validation is the whole validation story on the client now, and it
						is better than what it replaced: `:user-invalid` only styles a field the
						visitor has actually interacted with, so the border turns red as they leave
						a malformed address rather than only after a round trip. */}
						<input
							id="email"
							type="email"
							name="email"
							required
							aria-label={label}
							placeholder="user@domain.tld"
							mix={[
								is("100%"),
								pi(5),
								pb(2.5),
								css({ borderRadius: "0.125rem" }),
								border({ color: "color.neutral.200", width: 2 }),
								css({ backgroundColor: "#ffffff", outline: "none" }),
								placeholder(fg("color.neutral.500")),
								focusVisible(raw({ borderColor: "#000000" })),
								when("&:user-invalid", border("color.danger.500")),
								when("&:user-valid", border("color.success.500")),
								dark([
									border("color.neutral.800"),
									raw({ backgroundColor: "#000000" }),
									fg("color.neutral.100"),
									placeholder(fg("color.neutral.300")),
									focusVisible(raw({ borderColor: "#ffffff" })),
								]),
							]}
						/>
					</div>

					<button
						type="submit"
						mix={[
							shrink(0),
							css({ borderRadius: "0.125rem" }),
							pi(5),
							pb(2.5),
							bg("color.neutral.950"),
							fg("color.neutral.50"),
							dark([bg("color.neutral.50"), fg("color.neutral.950")]),
						]}
					>
						{submitLabel}
					</button>
				</div>

				<small
					mix={[
						vstack({ gap: 0.5, align: "baseline" }),
						pretty(),
						fg("color.neutral.700"),
						media(SIDE_BY_SIDE, [pi(5)]),
						dark(fg("color.neutral.300")),
					]}
				>
					<span>No spam. Unsubscribe anytime.</span>
					{error && (
						<em
							mix={[
								weight("medium"),
								whiteSpace("pre-line"),
								css({ fontStyle: "normal" }),
								fg("color.danger.500"),
								dark(fg("color.danger.400")),
							]}
						>
							{error}
						</em>
					)}
				</small>
			</form>
		);
	};
}
