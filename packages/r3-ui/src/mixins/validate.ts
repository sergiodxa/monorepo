/**
 * Applies a shared `remix/data-schema` field schema to a native form
 * control's current value, layering the schema's verdict onto the field's
 * own Constraint Validation API state through `setCustomValidity()`. Once
 * the browser's own validation attempt flags the field, this mirrors the
 * resulting message into the field's `FieldError` slot instead of letting
 * the browser render its native validation bubble for it.
 *
 * Why JS: turning an arbitrary schema check into a message the browser's own
 * `invalid` event and `:invalid`/`:user-invalid` selectors already
 * understand requires evaluating that schema in script — no HTML constraint
 * attribute expresses a schema-shaped check.
 * No-JS baseline: the field's native constraint attributes (`required`,
 * `pattern`, `minlength`, `type="email"`, ...) still block submission on
 * their own, and the browser's own validation bubble reports them; the
 * server re-validates the same shared schema on submit and re-renders the
 * field with whatever `FieldError` message it finds.
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
 * Attribute the FieldError slot exposes itself on. A field's own
 * `aria-describedby` may list more than one id — a Description alongside a
 * FieldError — so {@link validate} walks those ids and mirrors the schema's
 * verdict into the first one carrying this attribute, rather than assuming
 * the FieldError sits at a fixed position in the DOM relative to the field.
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
 * submit button, announcing the change through a live region — without
 * polling the field's `validity` state itself.
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
 * the field's native validity through `setCustomValidity()` — an empty
 * string clears any previous custom error, leaving the field's other native
 * constraints (`required`, `pattern`, ...) to keep deciding validity on
 * their own.
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
 * for assistive technology (the field's own styling already reacts to
 * `:user-invalid` without help from script), and writes `message` into the
 * FieldError slot found through {@link findFieldErrorSlot}, hiding that slot
 * again once `message` is empty.
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
 * Adds schema-driven client validation to a native form field. Every `input`
 * keeps the field's Constraint Validation API state current with `schema`'s
 * verdict through `setCustomValidity()`, so the browser's own submission
 * blocking and `:invalid`/`:user-invalid` selectors already reflect it.
 *
 * The first time the browser actually reports the field invalid — a submit
 * attempt, or any `reportValidity()` call — `validate()` intercepts that
 * `invalid` event in the capture phase (the event does not bubble, so the
 * field is where it must be caught), prevents the browser's own validation
 * bubble, and mirrors `field.validationMessage` into the field's FieldError
 * slot instead. From that point on, every further `input` keeps the
 * FieldError slot and `aria-invalid` live as the value changes, clearing
 * them again once the field satisfies `schema` and every other constraint.
 *
 * Dispatches {@link ValidateChangeEvent} on the field whenever this changes
 * whether it's valid.
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
export const validate = createMixin<ValidatableField, [schema: Schema<string, unknown>]>(
	(handle) => {
		let hasReported = false;

		handle.addEventListener("remove", () => {
			hasReported = false;
		});

		return (schema) => {
			return createElement(handle.element, {
				mix: [
					on<ValidatableField, "input">("input", (event) => {
						let field = event.currentTarget;
						let message = applySchema(field, schema);

						if (!hasReported) return;

						mirrorValidity(field, message);
						field.dispatchEvent(new ValidateChangeEvent({ valid: message === "", message }));
					}),
					on<ValidatableField, "invalid">(
						"invalid",
						(event) => {
							event.preventDefault();

							let field = event.currentTarget;
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
	},
);
