/**
 * Turns an Attachment.Trigger's whole card surface into a single activation
 * target — following its `href` like a link, or opening the `<dialog>` its
 * `commandfor` names, defaulting to the `"show-modal"` command when none is
 * given — while every Attachment.Action button nested inside the card, or any
 * other native control a consumer places there, keeps answering its own
 * click, tap, or keypress exactly as it would on its own. A primary click or
 * `Enter`/`Space` activates the card in place; a modifier-held click, a
 * middle click, or a `target` attribute already set on the host opens a link
 * destination in a new tab instead.
 *
 * Why JS: making the whole card a link/dialog trigger while Attachment.Action
 * buttons stay independently clickable needs script to tell an action click
 * apart from a card click — no declarative HTML equivalent lets one element
 * react to an activation everywhere in its subtree except inside a
 * particular descendant.
 * No-JS baseline: the card renders fully readable; only the whole-card
 * click-through is unavailable, and actions remain independently clickable
 * via their own normal click/submit behavior.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Selector matching a native interactive control nested anywhere in the
 * card — an Attachment.Action button, a native form control, an editable
 * region — whose own click, tap, or keyboard handling {@link attachmentTrigger}
 * always leaves untouched instead of also activating the card underneath it.
 */
const NATIVE_CONTROL_SELECTOR =
	'a[href], button, input:not([type="hidden"]), select, textarea, summary, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"]';

/**
 * `command` value {@link attachmentTrigger} acts on when the host carries a
 * `commandfor` reference instead of an `href` — the only Invoker Commands
 * keyword that opens a `<dialog>`, matched against the rest of the catalog's
 * own dialog-opening buttons. Assumed when the host omits `command`
 * altogether, since opening is the only thing a trigger ever does.
 */
const DEFAULT_DIALOG_COMMAND = "show-modal";

/** DOM event type dispatched on a host by {@link attachmentTrigger} right before it follows a link or opens a dialog. */
const ATTACHMENT_TRIGGER_EVENT = "ui:attachment-trigger" as const;

declare global {
	interface HTMLElementEventMap {
		[ATTACHMENT_TRIGGER_EVENT]: AttachmentTriggerEvent;
	}
}

/**
 * Dispatched on an Attachment.Trigger host by {@link attachmentTrigger} right
 * before it follows a link or opens a dialog in response to a card
 * activation, so a consumer can react — log analytics, swap in a custom
 * viewer — before the default effect runs. Canceling it (`preventDefault()`)
 * stops that default effect entirely, leaving the activation otherwise
 * unobserved by the mixin.
 */
export class AttachmentTriggerEvent extends Event {
	/** The `href` this activation is about to follow, or `null` when it opens a dialog instead. */
	readonly href: string | null;

	/**
	 * @param href The `href` this activation is about to follow, or `null` for a dialog activation.
	 */
	constructor(href: string | null) {
		super(ATTACHMENT_TRIGGER_EVENT, { bubbles: true, cancelable: true });
		this.href = href;
	}
}

/**
 * What a host configured for {@link attachmentTrigger} does once a card
 * activation reaches it — resolved fresh on every activation from the host's
 * own `href`/`commandfor` attributes rather than cached, so a later render
 * changing them is always honored.
 */
type ResolvedAction =
	| { kind: "link"; href: string }
	| { kind: "dialog"; dialog: HTMLDialogElement };

/**
 * Reads what a card activation should do from the host's own attributes: an
 * `href` wins as a link activation; otherwise a `commandfor` reference is
 * resolved against {@link DEFAULT_DIALOG_COMMAND} and must name a `<dialog>`
 * element. Returns `undefined` — logging a dev-mode warning explaining why —
 * for a host that names neither, or whose `commandfor` doesn't resolve to a
 * dialog.
 *
 * @param host Element {@link attachmentTrigger} is mixed onto.
 * @returns The resolved action, or `undefined` when the host has nothing configured to do.
 */
function resolveAction(host: HTMLElement): ResolvedAction | undefined {
	let href = host.getAttribute("href");
	if (href) return { kind: "link", href };

	let commandForId = host.getAttribute("commandfor");
	if (commandForId === null) return undefined;

	let command = host.getAttribute("command") ?? DEFAULT_DIALOG_COMMAND;
	if (command !== DEFAULT_DIALOG_COMMAND) {
		if (import.meta.env.DEV) {
			console.warn(
				`attachmentTrigger(): unsupported command "${command}" — only "${DEFAULT_DIALOG_COMMAND}" opens a dialog from a card activation.`,
			);
		}
		return undefined;
	}

	let dialog = document.getElementById(commandForId);
	if (!(dialog instanceof HTMLDialogElement)) {
		if (import.meta.env.DEV) {
			console.warn(
				`attachmentTrigger(): commandfor="${commandForId}" doesn't reference a <dialog> element.`,
			);
		}
		return undefined;
	}

	return { kind: "dialog", dialog };
}

/**
 * Reports whether `target` sits inside a {@link NATIVE_CONTROL_SELECTOR}
 * match that isn't `host` itself, so a click bubbling up from an
 * Attachment.Action button (or any other native control nested in the card)
 * is told apart from one landing on the card's own surface.
 *
 * @param host Element {@link attachmentTrigger} is mixed onto.
 * @param target Event target the activation originated from.
 * @returns Whether `target` is inside a native control nested in `host`.
 */
function isNativeControlDescendant(host: HTMLElement, target: Element): boolean {
	let control = target.closest(NATIVE_CONTROL_SELECTOR);
	return control !== null && control !== host && host.contains(control);
}

/**
 * Dispatches {@link AttachmentTriggerEvent} on `host` and, unless a listener
 * cancels it, carries out `action`: opens its dialog, or follows its link —
 * in a new tab when `newTab` is set or the host's own `target` attribute
 * reads `"_blank"`, into the host's named `target` when it names one, or in
 * place otherwise.
 *
 * @param host Element {@link attachmentTrigger} is mixed onto.
 * @param action Action resolved by {@link resolveAction} for this activation.
 * @param newTab Whether the activation itself (a modifier-held click, a middle click) asked for a new tab.
 */
function performAction(host: HTMLElement, action: ResolvedAction, newTab: boolean): void {
	let allowed = host.dispatchEvent(
		new AttachmentTriggerEvent(action.kind === "link" ? action.href : null),
	);
	if (!allowed) return;

	if (action.kind === "dialog") {
		if (!action.dialog.open) action.dialog.showModal();
		return;
	}

	let hostTarget = host.getAttribute("target");
	if (newTab || hostTarget === "_blank") window.open(action.href, "_blank", "noopener,noreferrer");
	else if (hostTarget) window.open(action.href, hostTarget);
	else location.assign(action.href);
}

/**
 * Makes an Attachment.Trigger's whole card activatable — by a primary click
 * or tap anywhere on it, or by `Enter`/`Space` while it holds focus — as a
 * link or a dialog trigger, while every Attachment.Action button (or other
 * native control) nested inside keeps handling its own click, tap, and
 * keypress completely on its own; a card activation and an action's own
 * activation never both fire for the same interaction.
 *
 * The host configures which it becomes through the same attributes the rest
 * of the catalog already uses for the same purpose: an `href` makes it a
 * link, opened in place unless the activation held a modifier key, was a
 * middle click, or the host's own `target` attribute says otherwise; a
 * `commandfor` reference makes it a dialog trigger, opening the `<dialog>`
 * it names (`command` defaults to `"show-modal"` when omitted). A host
 * carrying neither, or an `aria-disabled="true"` host, ignores every
 * activation.
 *
 * @returns A mixin descriptor for an Attachment.Trigger's `mix` prop.
 * @example
 * <Attachment.Trigger href="/files/quarterly-report.pdf" mix={attachmentTrigger()}>
 * 	<Attachment state="done">
 * 		<Attachment.Media><FileTextIcon aria-hidden /></Attachment.Media>
 * 		<Attachment.Content>
 * 			<Attachment.Title>quarterly-report.pdf</Attachment.Title>
 * 		</Attachment.Content>
 * 		<Attachment.Actions>
 * 			<Attachment.Action aria-label={t("attachment.download")}>
 * 				<DownloadIcon />
 * 			</Attachment.Action>
 * 		</Attachment.Actions>
 * 	</Attachment>
 * </Attachment.Trigger>
 * @example
 * <Attachment.Trigger commandfor="quarterly-report-preview" mix={attachmentTrigger()}>
 * 	<Attachment state="done">
 * 		<Attachment.Media><FileTextIcon aria-hidden /></Attachment.Media>
 * 		<Attachment.Content>
 * 			<Attachment.Title>quarterly-report.pdf</Attachment.Title>
 * 		</Attachment.Content>
 * 	</Attachment>
 * </Attachment.Trigger>
 * <Dialog id="quarterly-report-preview">...</Dialog>
 */
export const attachmentTrigger: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "click">("click", (event) => {
					let host = event.currentTarget;
					if (host.getAttribute("aria-disabled") === "true") return;
					if (!(event.target instanceof Element) || isNativeControlDescendant(host, event.target)) {
						return;
					}

					let action = resolveAction(host);
					if (!action) return;

					event.preventDefault();
					performAction(host, action, event.ctrlKey || event.metaKey || event.shiftKey);
				}),
				on<HTMLElement, "auxclick">("auxclick", (event) => {
					if (event.button !== 1) return;

					let host = event.currentTarget;
					if (host.getAttribute("aria-disabled") === "true") return;
					if (!(event.target instanceof Element) || isNativeControlDescendant(host, event.target)) {
						return;
					}

					let action = resolveAction(host);
					if (!action || action.kind !== "link") return;

					event.preventDefault();
					performAction(host, action, true);
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					let host = event.currentTarget;
					if (event.target !== host) return;
					if (host.getAttribute("aria-disabled") === "true") return;

					let action = resolveAction(host);
					if (!action) return;
					if (event.key !== "Enter" && !(event.key === " " && action.kind === "dialog")) return;

					event.preventDefault();
					performAction(host, action, event.ctrlKey || event.metaKey || event.shiftKey);
				}),
			],
		});
});
