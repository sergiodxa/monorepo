/**
 * The id and aria wiring shared by every labeled, described, and validated
 * field convenience wrapper: the resolved semantic color role, the resolved
 * invalid state, the ids reserved for the field's description and error
 * paragraphs, and the joined `aria-describedby` value linking the control to
 * whichever of the two are present. Every field wrapper derives this same
 * handful of values from its own stable identifier and props right after
 * destructuring, so this module gives that computation one home instead of a
 * copy per field type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Semantic color role shared by every field convenience wrapper's control,
 * each mapped to its matching `--ui-*` variables.
 */
export type FieldColor = "brand" | "neutral" | "success" | "warning" | "danger";

/** Semantic color role {@link resolveFieldWiring} falls back to when `color` is omitted. */
const DEFAULT_FIELD_COLOR: FieldColor = "neutral";

/**
 * The full range of values a native `aria-invalid` attribute accepts: a plain
 * boolean, its string form, or the finer-grained `"grammar"`/`"spelling"`
 * validity distinction.
 */
export type AriaInvalid = boolean | "true" | "false" | "grammar" | "spelling";

/**
 * What a field actually renders into `aria-invalid`: one of the tokens that
 * says something, or nothing at all for a valid field.
 *
 * Narrower than {@link AriaInvalid} on purpose, and the narrowing is the whole
 * point. `aria-invalid` takes a token, not a flag, so a `true` reaching the
 * attribute is serialized the way HTML wants booleans written — as the bare
 * name — leaving `aria-invalid=""`, which is not a token it recognizes and so
 * resolves to its default of valid. An invalid field would be announced as
 * fine. {@link resolveFieldWiring} therefore folds every accepted input into
 * one of these before it can reach an attribute, and a valid field is spelled
 * as the absent attribute rather than as `"false"`, since that is what absence
 * already means.
 */
export type AriaInvalidToken = "true" | "grammar" | "spelling";

/**
 * Inputs {@link resolveFieldWiring} reads off a field convenience wrapper's
 * own props to compute its wiring.
 */
export interface FieldWiringOptions {
	/** Semantic color role for the control's focus ring. Falls back to {@link DEFAULT_FIELD_COLOR} when omitted. */
	color?: FieldColor;
	/**
	 * Validation message rendered beneath the control. Only its presence is
	 * read, never its content: it marks the field invalid and reserves an id
	 * for its own error paragraph, unless `ariaInvalid` overrides it.
	 */
	errorMessage?: unknown;
	/**
	 * Supporting description rendered beneath the control. Only its presence
	 * is read, never its content: it reserves an id for its own paragraph.
	 */
	description?: unknown;
	/** Explicit override for the field's invalid state. Defaults to whether `errorMessage` is set. */
	ariaInvalid?: AriaInvalid;
}

/**
 * Resolved id and aria wiring {@link resolveFieldWiring} produces for a
 * single field convenience wrapper instance.
 */
export interface FieldWiring {
	/** Resolved semantic color role for the control's focus ring. */
	resolvedColor: FieldColor;
	/** Resolved invalid state for the control's `aria-invalid`, or `undefined` when the field is valid. */
	resolvedInvalid: AriaInvalidToken | undefined;
	/** Id for the field's description paragraph, or `undefined` when no description is set. */
	descriptionId: string | undefined;
	/** Id for the field's error paragraph, or `undefined` when no error message is set. */
	errorId: string | undefined;
	/** Space-joined `aria-describedby` value referencing whichever of `descriptionId`/`errorId` are set, or `undefined` when neither is. */
	describedBy: string | undefined;
}

/**
 * Computes the id and aria wiring a labeled, described, and validated field
 * convenience wrapper needs to link its composed parts together: the
 * control's resolved color role, its resolved invalid state, the ids
 * reserved for its description and error paragraphs — each derived from
 * `id` — and the joined `aria-describedby` value referencing whichever of
 * the two are present. A field wrapper calls this once, right after
 * destructuring its own props, keeping the id bookkeeping between its label,
 * control, description, and error identical across every field type.
 *
 * @param id The field instance's own stable identifier, prefixed onto its description and error paragraph ids.
 * @param options The field's own color, error message, description, and invalid override.
 * @returns The resolved color, invalid state, description/error ids, and joined `aria-describedby` value.
 * @example
 * resolveFieldWiring("email", { color: "brand", errorMessage: "Required" });
 * // { resolvedColor: "brand", resolvedInvalid: "true", descriptionId: undefined, errorId: "email-error", describedBy: "email-error" }
 * @example
 * resolveFieldWiring("username", { description: "3-20 characters" });
 * // { resolvedColor: "neutral", resolvedInvalid: undefined, descriptionId: "username-description", errorId: undefined, describedBy: "username-description" }
 */
export function resolveFieldWiring(id: string, options: FieldWiringOptions): FieldWiring {
	let { color, errorMessage, description, ariaInvalid } = options;
	let resolvedColor = color ?? DEFAULT_FIELD_COLOR;
	let resolvedInvalid = resolveAriaInvalid(ariaInvalid ?? Boolean(errorMessage));
	let descriptionId = description ? `${id}-description` : undefined;
	let errorId = errorMessage ? `${id}-error` : undefined;
	let describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

	return { resolvedColor, resolvedInvalid, descriptionId, errorId, describedBy };
}

/**
 * Folds any accepted invalid state into the token a field can safely render,
 * or `undefined` for a field that is valid.
 *
 * @param invalid The state a field resolved from its own props.
 * @returns The token to render, or `undefined` to render no attribute at all.
 */
function resolveAriaInvalid(invalid: AriaInvalid): AriaInvalidToken | undefined {
	if (invalid === true || invalid === "true") return "true";
	if (invalid === "grammar" || invalid === "spelling") return invalid;
	return undefined;
}
