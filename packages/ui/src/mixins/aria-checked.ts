/**
 * Keeps `aria-checked` on a native checked-state control in sync with its
 * live checkedness, since the attribute is static and won't follow a
 * control's state on its own. Opt-in, for a control inside a hydrated
 * island: with no JavaScript, assistive technology reads checkedness off
 * the control itself already.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute {@link ariaChecked} owns on its host. It carries a token rather
 * than a flag — `"true"`, `"false"`, or `"mixed"` — since an empty value is
 * none of the tokens ARIA defines and resolves to the attribute's default.
 */
const CHECKED_ATTRIBUTE = "aria-checked";

/** Input `type` whose checkedness is shared across a whole group rather than owned by one control. */
const RADIO_TYPE = "radio";

/**
 * Matches the radios {@link syncAriaChecked} refreshes alongside the one that
 * fired: every radio in the group already carrying {@link CHECKED_ATTRIBUTE},
 * the set that opted into this mixin.
 */
const GROUP_SELECTOR = `input[type="${RADIO_TYPE}"][${CHECKED_ATTRIBUTE}]`;

/** The three values {@link CHECKED_ATTRIBUTE} may hold, as the string tokens ARIA defines. */
type AriaCheckedToken = "true" | "false" | "mixed";

/**
 * The host props {@link ariaChecked} reads its server-rendered token from,
 * taken directly off the props the host element was rendered with, so the
 * token always agrees with the control it sits on.
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
 * Resolves the token for a control that has not been rendered yet, from props
 * alone. `indeterminate` is DOM-only, so only a prop set at render time is
 * visible here; a live toggle is caught by {@link liveToken} instead.
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
 * {@link CHECKED_ATTRIBUTE}, scoped by name and form owner. Names are compared
 * in script since a `name` may hold characters a CSS selector would escape.
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
 * Rewrites {@link CHECKED_ATTRIBUTE} on `control`, and on its sibling radios,
 * since picking one radio unchecks another with no `change` event of its own.
 * Call this directly after a programmatic checked/indeterminate write or a form reset, neither of which fires `change`.
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
 * Adds `aria-checked` to a checkbox, switch, or radio, syncing it from the
 * host's own render-time state and again on every `change`. Apply the mixin
 * to every radio in a shared group — a change refreshes only the ones that carry it.
 *
 * @returns A mixin descriptor for a checkbox's, switch's, or radio's `mix` prop.
 * @see {@link syncAriaChecked} to resync after a programmatic checked/indeterminate write or a form reset, neither of which fires `change`.
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
