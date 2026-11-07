/**
 * Validates a submission of the Wakaba support form. Every field is trimmed and bounded
 * here, so the email built from a request that passes carries readable, single-line
 * headers and a message no larger than an inbox should receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "remix/data-schema";

import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { PageLocale } from "~/app/services/page-locale";

import { choice, replyAddress } from "~/app/http/validators/fields";

/** The topics a visitor picks from, in the order the form lists them. */
export const WAKABA_SUPPORT_TOPICS = [
	"Bug report",
	"Question",
	"Feature request",
	"Vocabulary correction",
	"Other",
] as const;

/** The devices Wakaba ships on, plus a fallback for anything else. */
export const WAKABA_SUPPORT_PLATFORMS = ["iPhone", "iPad", "Other"] as const;

/**
 * Character limits the form's `maxlength` attributes repeat, so a browser stops the visitor
 * at the same point the server would reject. The email bound is RFC 5321's path limit.
 */
export const WAKABA_SUPPORT_LIMITS = {
	name: 100,
	email: 254,
	version: 50,
	message: 5000,
} as const;

/** The shortest message worth sending: enough for one sentence describing the problem. */
export const WAKABA_SUPPORT_MESSAGE_MIN = 10;

/** The messages a failed field shows, in one language. */
interface SupportMessages {
	nameTooLong: string;
	versionTooLong: (field: "os" | "app") => string;
	oneLine: string;
	emailMissing: string;
	emailTooLong: string;
	emailInvalid: string;
	topic: string;
	platform: string;
	messageMissing: string;
	messageTooShort: string;
	messageTooLong: string;
}

/** The field messages in each language the support page is written in. */
const MESSAGES: Record<PageLocale, SupportMessages> = {
	en: {
		nameTooLong: `Name must be ${WAKABA_SUPPORT_LIMITS.name} characters or fewer.`,
		versionTooLong: (field) =>
			`${field === "os" ? "OS version" : "App version"} must be ${WAKABA_SUPPORT_LIMITS.version} characters or fewer.`,
		oneLine: "This field must fit on one line.",
		emailMissing: "Enter your email address so I can reply.",
		emailTooLong: `Email must be ${WAKABA_SUPPORT_LIMITS.email} characters or fewer.`,
		emailInvalid: "Enter a valid email address, like name@example.com.",
		topic: "Choose a topic.",
		platform: "Choose the device you're using.",
		messageMissing: "Enter a message describing how I can help.",
		messageTooShort: `Your message must be at least ${WAKABA_SUPPORT_MESSAGE_MIN} characters.`,
		messageTooLong: `Your message must be ${WAKABA_SUPPORT_LIMITS.message} characters or fewer.`,
	},
	"es-AR": {
		nameTooLong: `El nombre debe tener ${WAKABA_SUPPORT_LIMITS.name} caracteres o menos.`,
		versionTooLong: (field) =>
			`${field === "os" ? "La versión del sistema" : "La versión de la app"} debe tener ${WAKABA_SUPPORT_LIMITS.version} caracteres o menos.`,
		oneLine: "Este campo debe ocupar una sola línea.",
		emailMissing: "Escribe tu correo electrónico para que pueda responderte.",
		emailTooLong: `El correo electrónico debe tener ${WAKABA_SUPPORT_LIMITS.email} caracteres o menos.`,
		emailInvalid: "Escribe un correo electrónico válido, como nombre@example.com.",
		topic: "Elige un tema.",
		platform: "Elige el dispositivo que usas.",
		messageMissing: "Escribe un mensaje que explique cómo puedo ayudarte.",
		messageTooShort: `Tu mensaje debe tener al menos ${WAKABA_SUPPORT_MESSAGE_MIN} caracteres.`,
		messageTooLong: `Tu mensaje debe tener ${WAKABA_SUPPORT_LIMITS.message} caracteres o menos.`,
	},
};

/** Whether `value` holds a line break or another control character, out of place in a one-line field. */
function hasControlCharacter(value: string): boolean {
	return Array.from(value).some((character) => {
		let code = character.codePointAt(0) ?? 0;
		return code < 0x20 || code === 0x7f;
	});
}

/** A one-line field that may be left blank, trimmed and capped, with its messages. */
function line(max: number, tooLong: string, oneLine: string) {
	return f.field(
		defaulted(string(), "")
			.transform((value) => value.trim())
			.refine((value) => value.length <= max, tooLong)
			.refine((value) => !hasControlCharacter(value), oneLine),
	);
}

/**
 * The support request as the form posts it, with the field messages in the page's language.
 * The honeypot fields post alongside it and are verified before this schema runs, so they
 * never reach a validated request.
 *
 * @param locale The language the page was read in.
 * @returns The schema for that language.
 */
export function wakabaSupportSchema(locale: PageLocale) {
	let messages = MESSAGES[locale];
	return f.object({
		name: line(WAKABA_SUPPORT_LIMITS.name, messages.nameTooLong, messages.oneLine),
		email: f.field(
			defaulted(string(), "")
				.transform((value) => value.trim())
				.refine((value) => value.length > 0, messages.emailMissing)
				.refine((value) => value.length <= WAKABA_SUPPORT_LIMITS.email, messages.emailTooLong)
				.refine(
					(value) => value.length === 0 || replyAddress(value) !== null,
					messages.emailInvalid,
				)
				.transform((value) => replyAddress(value) ?? value),
		),
		topic: choice(WAKABA_SUPPORT_TOPICS, messages.topic),
		platform: choice(WAKABA_SUPPORT_PLATFORMS, messages.platform),
		osVersion: line(WAKABA_SUPPORT_LIMITS.version, messages.versionTooLong("os"), messages.oneLine),
		appVersion: line(
			WAKABA_SUPPORT_LIMITS.version,
			messages.versionTooLong("app"),
			messages.oneLine,
		),
		message: f.field(
			defaulted(string(), "")
				.transform((value) => value.trim())
				.refine((value) => value.length > 0, messages.messageMissing)
				.refine(
					(value) => value.length === 0 || value.length >= WAKABA_SUPPORT_MESSAGE_MIN,
					messages.messageTooShort,
				)
				.refine((value) => value.length <= WAKABA_SUPPORT_LIMITS.message, messages.messageTooLong),
		),
	});
}

/** The support request schema with English messages. */
export const WakabaSupportRequestSchema = wakabaSupportSchema("en");

/** A validated Wakaba support request, ready to be mailed. */
export type WakabaSupportRequest = InferOutput<typeof WakabaSupportRequestSchema>;
