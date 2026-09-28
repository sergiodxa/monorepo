/**
 * Shape of the submit form. It is the board's only untrusted input, and every field is
 * required, so a posting that reaches the database is one a reader can act on: a contact
 * they can write to, and a salary and location they can judge the position by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";
import * as f from "remix/data-schema/form-data";

/** The submit form's fields, as the action receives them. */
export const PostingSchema = f.object({
	title: f.field(s.string().pipe(minLength(2))),
	company: f.field(s.string().pipe(minLength(2))),
	location: f.field(s.string().pipe(minLength(2))),
	salary: f.field(s.string().pipe(minLength(1))),
	description: f.field(s.string().pipe(minLength(10))),
	contact_email: f.field(s.string().pipe(email())),
});

/** A validated submission, as the action hands it to the model. */
export type PostingInput = s.InferOutput<typeof PostingSchema>;
