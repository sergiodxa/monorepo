/**
 * Keeps `aria-checked` on a native checked-state control — a checkbox,
 * including its `role="switch"` variant, or a radio — saying the same thing
 * the live control does: the token is rendered from the host's own initial
 * state during the server pass, then rewritten from the control itself every
 * time the user changes it.
 *
 * Why JS: `aria-checked` is a static attribute, while the checkedness it
 * reports lives on the live control and flips with no attribute change of
 * its own, so only a script can keep the two in step — and an authored value
 * takes precedence over the control's native state, so a stale one is worse
 * than none.
 * No-JS baseline: every control in this catalog renders no `aria-checked` at
 * all and assistive technology reads the checked state off the control
 * itself, which already works with no JavaScript. That is why this mixin is
 * opt-in and belongs on a control inside a hydrated island: applied where
 * JavaScript never runs, the attribute keeps whatever value the server
 * rendered and then overrides the very state it was added to report.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute {@link ariaChecked} owns on its host. It carries a token rather
 * than a flag — `"true"`, `"false"`, or `"mixed"` — since an empty value
 * (what an HTML boolean attribute would render as) is none of the tokens ARIA
 * defines and resolves to the attribute's default instead.
 */
const CHECKED_ATTRIBUTE = "aria-checked";

/** Input `type` whose checkedness is shared across a whole group rather than owned by one control. */
const RADIO_TYPE = "radio";

/**
 * Matches the radios {@link syncAriaChecked} refreshes alongside the one that
 * fired: every radio already carrying {@link CHECKED_ATTRIBUTE}, which is
 * exactly the set that opted into this mixin. A radio without the attribute
 * deliberately has none, so it is left alone rather than being given one.
 */
const GROUP_SELECTOR = `input[type="${RADIO_TYPE}"][${CHECKED_ATTRIBUTE}]`;

/** The three values {@link CHECKED_ATTRIBUTE} may hold, as the string tokens ARIA defines. */
type AriaCheckedToken = "true" | "false" | "mixed";

/**
 * The host props {@link ariaChecked} derives its server-rendered token from,
 * read off the props the host element was rendered with rather than asked for
 * as an argument, so the mixin can never be told a state that disagrees with
 * the control it sits on.
 */
interface CheckedStateProps {
	/** `true` for a control whose checked state the consumer tracks itself. */
	checked?: boolean;
	/** `true` for a control the consumer lets the platform track from an initial state. */
	defaultChecked?: boolean;
	/** `true` for a checkbox rendered in its third, partially-checked state. */
	indeterminate?: boolean;
}

/**
 * Resolves the token for a control that has not been rendered yet, from the
 * props alone.
 *
 * `indeterminate` is a DOM property with no HTML attribute behind it, so a
 * server pass only knows about it when the host was handed an `indeterminate`
 * prop; a script assigning `input.indeterminate` after mount is invisible
 * here and is picked up by {@link liveToken} instead.
 *
 * @param props Props the host element is being rendered with.
 * @returns `"mixed"` for a partially-checked control, otherwise the token matching its initial checkedness.
 */
function initialToken(props: CheckedStateProps): AriaCheckedToken {
	if (props.indeterminate === true) return "mixed";
	return (props.checked ?? props.defaultChecked) === true ? "true" : "false";
}

/**
 * Reads the token straight off a mounted control's live properties, which is
 * the only state that stays true after the user has interacted with it.
 *
 * @param control Mounted checkbox or radio to read.
 * @returns `"mixed"` for a control whose `indeterminate` property is set, otherwise the token matching `checked`.
 */
function liveToken(control: HTMLInputElement): AriaCheckedToken {
	if (control.indeterminate) return "mixed";
	return control.checked ? "true" : "false";
}

/**
 * Every radio sharing `control`'s group that already carries
 * {@link CHECKED_ATTRIBUTE}. A group is scoped by name and by form owner, so
 * the search runs over `control.form` where the radio belongs to a form and
 * over its document otherwise, and the name is compared in script rather than
 * written into the selector, since a `name` may hold characters a CSS
 * attribute selector would have to escape.
 *
 * @param control Radio whose group is collected.
 * @returns The group's radios, empty for an unnamed radio, which the platform groups with nothing.
 */
function groupMembers(control: HTMLInputElement): HTMLInputElement[] {
	if (control.name === "") return [];

	let form = control.form;
	let candidates =
		form === null
			? control.ownerDocument.querySelectorAll<HTMLInputElement>(GROUP_SELECTOR)
			: form.querySelectorAll<HTMLInputElement>(GROUP_SELECTOR);
	let members: HTMLInputElement[] = [];

	for (let candidate of candidates) {
		if (candidate.name !== control.name) continue;
		if (candidate.form !== control.form) continue;
		members.push(candidate);
	}

	return members;
}

/**
 * Rewrites {@link CHECKED_ATTRIBUTE} on `control` from its live state, and on
 * every other radio in the same group when `control` is a radio.
 *
 * The group pass is what a checkbox never needs and a radio cannot do
 * without: picking radio B unchecks sibling A silently, with no event of A's
 * own, so refreshing only the control that fired would leave A announcing
 * itself as still checked. Disabled radios are refreshed along with the rest
 * — a disabled radio that started out checked still loses its checkedness the
 * moment somebody picks an enabled sibling.
 *
 * {@link ariaChecked} calls this on mount and on every `change`. Call it
 * directly after the two things the platform reports no event for: assigning
 * `control.checked` or `control.indeterminate` from script, and resetting the
 * enclosing form (`reset` fires on the form, and the controls revert without
 * a `change` of their own).
 *
 * @param control Mounted checkbox or radio whose attribute is brought back in line.
 * @example
 * selectAll.indeterminate = someButNotAllSelected;
 * syncAriaChecked(selectAll);
 */
export function syncAriaChecked(control: HTMLInputElement): void {
	control.setAttribute(CHECKED_ATTRIBUTE, liveToken(control));
	if (control.type !== RADIO_TYPE) return;

	for (let member of groupMembers(control)) {
		if (member === control) continue;
		member.setAttribute(CHECKED_ATTRIBUTE, liveToken(member));
	}
}

/**
 * Adds `aria-checked` to a native checked-state control and keeps it correct:
 * a checkbox, a checkbox rendered as a switch, or a radio. The server pass
 * writes the token derived from the host's own `checked`/`defaultChecked` (or
 * `indeterminate`) props, so the markup is already right before any
 * JavaScript runs, and each `change` rewrites it from the live control after
 * that. Nothing needs to be passed in: the mixin reads the state off the
 * props its host element was rendered with, so there is no second copy of the
 * checked state to drift out of line with the first.
 *
 * On a radio, every `change` refreshes the whole group — same `name`, same
 * form owner — not only the radio the user picked, since its previously
 * checked sibling loses its checkedness with no event of its own. Apply the
 * mixin to every radio in a group: only radios already carrying the
 * attribute are refreshed, so a group where some radios opted in and others
 * did not can leave the ones that did stale, the browser having fired
 * `change` only on the radio the user picked.
 *
 * On mount, the token is rewritten once from the live control, which catches
 * the state a browser restored on a reload or a back-navigation, and a click
 * the user got in before the island hydrated.
 *
 * `change` is the only event listened for; it is the one every checked-state
 * control fires for a user interaction, from a click on the control, a click
 * on its `<label>`, or the keyboard. Deliberately not caught: a programmatic
 * `checked`/`indeterminate` assignment and a form reset, neither of which
 * fires `change` at all — call {@link syncAriaChecked} for those.
 *
 * @returns A mixin descriptor for a checkbox's, switch's, or radio's `mix` prop.
 * @example
 * <Switch name="notifications" defaultChecked mix={[ariaChecked()]}>
 * 	{t("settings.notifications.label")}
 * </Switch>
 * @example
 * <Checkbox name="terms" mix={[ariaChecked()]}>{t("signup.acceptTerms")}</Checkbox>
 * @example
 * // A radio's own input sits behind the `parts.input` passthrough.
 * <RadioGroup.Radio value="express" parts={{ input: [ariaChecked()] }}>
 * 	{t("shipping.express")}
 * </RadioGroup.Radio>
 */
export const ariaChecked: MixinFactory<HTMLInputElement> = createMixin<HTMLInputElement>(
	(handle) => {
		handle.addEventListener("insert", (event) => {
			syncAriaChecked(event.node);
		});

		return (props: CheckedStateProps) =>
			createElement(handle.element, {
				[CHECKED_ATTRIBUTE]: initialToken(props),
				mix: [
					on<HTMLInputElement, "change">("change", (event) => {
						syncAriaChecked(event.currentTarget);
					}),
				],
			});
	},
);
