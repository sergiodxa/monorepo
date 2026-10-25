/**
 * The failures this package reports through `Result`: a document that is not valid
 * JSCalendar, a PatchObject that cannot be applied, an object iCalendar cannot express, and a
 * recurrence that cannot be expanded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One problem in a document, at the property path it was found. */
export interface Issue {
	/** Property names and array indexes from the root, e.g. `["entries", 0, "start"]`. */
	path: (string | number)[];
	message: string;
}

/** Text that is not JSON, or JSON that is not a valid Event, Task or Group. */
export class JSCalendarParseError extends Error {
	override name = "JSCalendarParseError";

	/** Every problem found; empty when the text is not JSON at all. */
	issues: Issue[];

	/**
	 * @param message - A summary naming the first problem
	 * @param issues - Every problem found
	 */
	constructor(message: string, issues: Issue[] = []) {
		super(message);
		this.issues = issues;
	}
}

/** A PatchObject with an invalid pointer, overlapping pointers, or a missing parent. */
export class PatchError extends Error {
	override name = "PatchError";

	/** The patch key that failed. */
	pointer: string;

	/**
	 * @param message - What is wrong
	 * @param pointer - The patch key that failed
	 */
	constructor(message: string, pointer: string) {
		super(message);
		this.pointer = pointer;
	}
}

/** A JSCalendar object that iCalendar's model cannot express, such as a non-Gregorian rule. */
export class ConversionError extends Error {
	override name = "ConversionError";
}

/** A recurrence that names a calendar system or zone this package cannot expand. */
export class RecurrenceError extends Error {
	override name = "RecurrenceError";
}
