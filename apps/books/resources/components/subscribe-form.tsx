/**
 * The email-capture form shared by every page that collects an address: a
 * heading, an email field with a submit button, a reassurance line, and an
 * error slot. It relies on native `<form method="post">` submission and the
 * browser's own progress indication, keeping this site free of client-side
 * JavaScript.
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
import { pretty, text, textTransform, weight, whiteSpace } from "@pkg/u/typography";
import { css } from "remix/ui";

/** The viewport width the field and button stop stacking at, matching the site's `lg`. */
const SIDE_BY_SIDE = "(min-width: 64rem)";

export namespace SubscribeForm {
	export interface Props {
		/** Where the form posts. */
		action: string;
		/**
		 * The submit button's label, rendered through CSS `text-transform:
		 * capitalize` so callers can pass it in natural case.
		 */
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
		/**
		 * Whether to show the "No spam" reassurance line under the field. On by default,
		 * and off for the upgrade form: someone upgrading is already a customer being asked
		 * for the address they bought with, not a visitor being asked to join a list.
		 */
		reassurance?: boolean;
	}
}

/**
 * Renders the email-capture form. Native `:user-invalid` styling marks only a
 * touched field, and the reassurance line keeps its padding at every width so
 * it never sits flush against the viewport edge on a phone.
 */
export default function SubscribeForm(handle: Handle<SubscribeForm.Props>) {
	return () => {
		let {
			action,
			attribution = {},
			error,
			label = "Email address",
			reassurance = true,
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
							textTransform("capitalize"),
							bg("color.neutral.950"),
							fg("color.neutral.50"),
							dark([bg("color.neutral.50"), fg("color.neutral.950")]),
						]}
					>
						{submitLabel}
					</button>
				</div>

				{reassurance ? (
					<small
						mix={[
							vstack({ gap: 0.5, align: "baseline" }),
							pretty(),
							fg("color.neutral.700"),
							pi(5),
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
				) : (
					error && (
						<p
							mix={[
								text("sm"),
								whiteSpace("pre-line"),
								fg("color.danger.600"),
								dark(fg("color.danger.400")),
							]}
						>
							{error}
						</p>
					)
				)}
			</form>
		);
	};
}
