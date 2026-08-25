/**
 * Applies a shared `remix/data-schema` field schema to a native form
 * control's current value, layering the verdict onto the field's Constraint
 * Validation API state via `setCustomValidity()` and mirroring it into the
 * field's `FieldError` slot once the browser flags it invalid, since no HTML
 * constraint attribute expresses a schema-shaped check on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { parseSafe } from "remix/data-schema";
import { createElement, createMixin, on } from "remix/ui";

/**
 * Native form control types that implement the Constraint Validation API —
 * `setCustomValidity()`, `validationMessage`, and the `invalid` event —
 * {@link validate} lays a schema's verdict onto.
 */
export type ValidatableField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Attribute the FieldError slot exposes itself on. Since `aria-describedby`
 * may list a Description alongside a FieldError, {@link validate} walks
 * those ids and mirrors the verdict into the first one carrying this attribute.
 */
export const FIELD_ERROR_ATTRIBUTE = "data-field-error";

/** DOM event type dispatched by {@link validate} whenever running its schema changes whether a field is valid. */
const VALIDATE_CHANGE_EVENT = "ui:validate-change" as const;

declare global {
	interface HTMLElementEventMap {
		[VALIDATE_CHANGE_EVENT]: ValidateChangeEvent;
	}
}

/**
 * Dispatched on a field by {@link validate} whenever running its schema
 * changes whether the field is valid, so a consumer can react — disabling a
 * submit button, a live-region announcement — without polling `validity`.
 */
export class ValidateChangeEvent extends Event {
	/** `true` once the field's current value satisfies the schema and every other constraint. */
	readonly valid: boolean;
	/** The message now sitting in `validationMessage`, empty once `valid` is `true`. */
	readonly message: string;

	/**
	 * @param init Snapshot of the field's validity at dispatch time.
	 */
	constructor(init: { valid: boolean; message: string }) {
		super(VALIDATE_CHANGE_EVENT, { bubbles: true });
		this.valid = init.valid;
		this.message = init.message;
	}
}

/**
 * Runs `schema` against `field`'s current value and layers the verdict onto
 * its native validity via `setCustomValidity()` — an empty string clears any
 * prior custom error, leaving the field's other constraints to keep deciding.
 *
 * @param field Field whose value `schema` checks.
 * @param schema Schema `field.value` is validated against.
 * @returns The message now sitting in `field.validationMessage`, which may
 * come from `schema`, from an untouched native constraint, or be empty when
 * the field is fully valid.
 */
function applySchema(field: ValidatableField, schema: Schema<string, unknown>): string {
	let result = parseSafe(schema, field.value);
	let message = result.success ? "" : (result.issues[0]?.message ?? "");
	field.setCustomValidity(message);
	return field.validationMessage;
}

/**
 * Finds the FieldError slot associated with `field` by walking the ids its
 * `aria-describedby` lists and returning the first one carrying
 * {@link FIELD_ERROR_ATTRIBUTE}.
 *
 * @param field Field whose `aria-describedby` is searched.
 * @returns The FieldError element, or `null` when none is wired or found.
 */
function findFieldErrorSlot(field: ValidatableField): HTMLElement | null {
	let describedBy = field.getAttribute("aria-describedby");
	if (describedBy === null) return null;

	for (let id of describedBy.split(/\s+/)) {
		let candidate = field.ownerDocument.getElementById(id);
		if (candidate?.hasAttribute(FIELD_ERROR_ATTRIBUTE)) return candidate;
	}

	return null;
}

/**
 * Mirrors `message` onto `field` and its FieldError slot: sets `aria-invalid`
 * for assistive technology since `:user-invalid` styling needs no script
 * help, and writes `message` into the slot from {@link findFieldErrorSlot}, hiding it once empty.
 *
 * @param field Field the message belongs to.
 * @param message Current `validationMessage`, empty when `field` is valid.
 */
function mirrorValidity(field: ValidatableField, message: string): void {
	field.setAttribute("aria-invalid", message === "" ? "false" : "true");

	let slot = findFieldErrorSlot(field);
	if (slot === null) {
		if (import.meta.env.DEV && message !== "") {
			console.warn(
				"validate(): no FieldError slot found through this field's aria-describedby; " +
					`add ${FIELD_ERROR_ATTRIBUTE} to the element the field describes its error with.`,
			);
		}
		return;
	}

	slot.textContent = message;
	slot.hidden = message === "";
}

/**
 * Adds schema-driven client validation to a form field: `input` keeps its
 * Constraint Validation state current via `setCustomValidity()`, and once
 * reported invalid, mirrors the message into the FieldError slot instead of the native bubble, dispatching {@link ValidateChangeEvent} on change.
 *
 * @param schema Schema checked against the field's raw string value —
 * typically the same schema the server parses the submitted form with.
 * @example
 * import * as s from "remix/data-schema";
 * import * as checks from "remix/data-schema/checks";
 *
 * let EmailSchema = s.string().pipe(checks.minLength(1), checks.email());
 * <input name="email" type="email" required aria-describedby="email-error" mix={[validate(EmailSchema)]} />
 * <p id="email-error" data-field-error hidden />
 */
export const validate = createMixin<HTMLElement, [schema: Schema<string, unknown>]>((handle) => {
	let hasReported = false;

	handle.addEventListener("remove", () => {
		hasReported = false;
	});

	return (schema) => {
		return createElement(handle.element, {
			mix: [
				on("input" as never, (event: Event) => {
					let field = event.currentTarget as ValidatableField;
					let message = applySchema(field, schema);

					if (!hasReported) return;

					mirrorValidity(field, message);
					field.dispatchEvent(new ValidateChangeEvent({ valid: message === "", message }));
				}),
				on(
					"invalid" as never,
					(event: Event) => {
						event.preventDefault();

						let field = event.currentTarget as ValidatableField;
						hasReported = true;

						let message = field.validationMessage;
						mirrorValidity(field, message);
						field.dispatchEvent(new ValidateChangeEvent({ valid: message === "", message }));
					},
					true,
				),
			],
		});
	};
});
