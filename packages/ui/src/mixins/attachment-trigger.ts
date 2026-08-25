/**
 * Turns an Attachment.Trigger's whole card into a single activation target,
 * following its `href` or opening the `<dialog>` its `commandfor` names.
 * Nested controls such as Attachment.Action buttons keep answering their
 * own click, tap, and keypress independently, since script is the only way
 * to exempt one descendant from a parent's activation handling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Selector matching a native interactive control nested in the card — an
 * Attachment.Action button, a form control, an editable region — that
 * {@link attachmentTrigger} always lets handle its own activation.
 */
const NATIVE_CONTROL_SELECTOR =
	'a[href], button, input:not([type="hidden"]), select, textarea, summary, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"]';

/**
 * `command` value {@link attachmentTrigger} acts on for a `commandfor`
 * host — the only Invoker Commands keyword that opens a `<dialog>`. Assumed
 * by default when `command` is omitted, since opening is all a trigger does.
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
 * Dispatched on an Attachment.Trigger host by {@link attachmentTrigger}
 * right before it follows a link or opens a dialog, so a consumer can react
 * — log analytics, swap in a custom viewer — or cancel it with `preventDefault()` to stop the default effect.
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
 * activation reaches it — resolved fresh from the host's own `href`/
 * `commandfor` attributes on every activation, so a later render changing them is honored.
 */
type ResolvedAction =
	| { kind: "link"; href: string }
	| { kind: "dialog"; dialog: HTMLDialogElement };

/**
 * Reads what a card activation should do from the host's own attributes:
 * an `href` wins as a link; otherwise a `commandfor` reference resolves
 * against {@link DEFAULT_DIALOG_COMMAND} and must name a `<dialog>` element.
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
 * match that isn't `host` itself, telling a click bubbling up from a nested
 * native control apart from one landing on the card's own surface.
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
 * Dispatches {@link AttachmentTriggerEvent} on `host` and, unless a
 * listener cancels it, carries out `action` — opening its dialog, or
 * following its link in a new tab, a named `target`, or in place, per the host's own attributes.
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
 * Makes an Attachment.Trigger's whole card activatable as a link or dialog
 * trigger through the same `href`/`commandfor` attributes {@link resolveAction}
 * reads; an `aria-disabled="true"` host ignores every activation, and nested controls keep answering their own click, tap, and keypress independently.
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
