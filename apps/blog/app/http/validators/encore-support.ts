/**
 * Validates a submission of the Encore support form. Every field is trimmed and bounded
 * here, so the email built from a request that passes carries readable, single-line
 * headers and a message no larger than an inbox should receive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InferOutput } from "remix/data-schema";

import { defaulted, string } from "remix/data-schema";
import * as f from "remix/data-schema/form-data";

import type { EncoreLocale } from "~/config/encore";

import { choice, replyAddress } from "~/app/http/validators/fields";

/** The topics a visitor picks from, in the order the form lists them. */
export const SUPPORT_TOPICS = ["Bug report", "Question", "Feature request", "Other"] as const;

/** The devices Encore ships on, plus a fallback for anything else. */
export const SUPPORT_PLATFORMS = ["iPhone", "iPad", "Apple Watch", "Mac", "Other"] as const;

/**
 * Character limits the form's `maxlength` attributes repeat, so a browser stops the visitor
 * at the same point the server would reject. The email bound is RFC 5321's path limit.
 */
export const SUPPORT_LIMITS = {
	name: 100,
	email: 254,
	version: 50,
	message: 5000,
} as const;

/** The shortest message worth sending: enough for one sentence describing the problem. */
export const SUPPORT_MESSAGE_MIN = 10;

/** The messages a failed field shows, in one language. */
interface SupportMessages {
	tooLong: (field: "name" | "os" | "app") => string;
	oneLine: (field: "name" | "os" | "app") => string;
	emailMissing: string;
	emailTooLong: string;
	emailInvalid: string;
	topic: string;
	platform: string;
	messageMissing: string;
	messageTooShort: string;
	messageTooLong: string;
}

/** How each language names the one-line fields in its messages. */
const FIELD_NAMES: Record<EncoreLocale, Record<"name" | "os" | "app", string>> = {
	en: { name: "Name", os: "OS version", app: "App version" },
	"es-AR": { name: "El nombre", os: "La versión del sistema", app: "La versión de la app" },
	ja: { name: "お名前", os: "OS のバージョン", app: "アプリのバージョン" },
};

/** The field messages in each language the support page is written in. */
const MESSAGES: Record<EncoreLocale, SupportMessages> = {
	en: {
		tooLong: (field) =>
			`${FIELD_NAMES.en[field]} must be ${field === "name" ? SUPPORT_LIMITS.name : SUPPORT_LIMITS.version} characters or fewer.`,
		oneLine: (field) => `${FIELD_NAMES.en[field]} must fit on one line.`,
		emailMissing: "Enter your email address so we can reply.",
		emailTooLong: `Email must be ${SUPPORT_LIMITS.email} characters or fewer.`,
		emailInvalid: "Enter a valid email address, like name@example.com.",
		topic: "Choose a topic.",
		platform: "Choose the device you're using.",
		messageMissing: "Enter a message describing how we can help.",
		messageTooShort: `Your message must be at least ${SUPPORT_MESSAGE_MIN} characters.`,
		messageTooLong: `Your message must be ${SUPPORT_LIMITS.message} characters or fewer.`,
	},
	"es-AR": {
		tooLong: (field) =>
			`${FIELD_NAMES["es-AR"][field]} debe tener ${field === "name" ? SUPPORT_LIMITS.name : SUPPORT_LIMITS.version} caracteres o menos.`,
		oneLine: (field) => `${FIELD_NAMES["es-AR"][field]} debe ocupar una sola línea.`,
		emailMissing: "Escribí tu correo electrónico para que podamos responderte.",
		emailTooLong: `El correo electrónico debe tener ${SUPPORT_LIMITS.email} caracteres o menos.`,
		emailInvalid: "Escribí un correo electrónico válido, como nombre@example.com.",
		topic: "Elegí un tema.",
		platform: "Elegí el dispositivo que usás.",
		messageMissing: "Escribí un mensaje que cuente en qué podemos ayudarte.",
		messageTooShort: `Tu mensaje debe tener al menos ${SUPPORT_MESSAGE_MIN} caracteres.`,
		messageTooLong: `Tu mensaje debe tener ${SUPPORT_LIMITS.message} caracteres o menos.`,
	},
	ja: {
		tooLong: (field) =>
			`${FIELD_NAMES.ja[field]}は${field === "name" ? SUPPORT_LIMITS.name : SUPPORT_LIMITS.version}文字以内で入力してください。`,
		oneLine: (field) => `${FIELD_NAMES.ja[field]}は1行で入力してください。`,
		emailMissing: "返信先のメールアドレスを入力してください。",
		emailTooLong: `メールアドレスは${SUPPORT_LIMITS.email}文字以内で入力してください。`,
		emailInvalid: "name@example.com のような有効なメールアドレスを入力してください。",
		topic: "お問い合わせの種類を選んでください。",
		platform: "お使いのデバイスを選んでください。",
		messageMissing: "お問い合わせ内容を入力してください。",
		messageTooShort: `メッセージは${SUPPORT_MESSAGE_MIN}文字以上で入力してください。`,
		messageTooLong: `メッセージは${SUPPORT_LIMITS.message}文字以内で入力してください。`,
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
 * Topics and devices post the same English values in every language, so the email reads the
 * same whichever page sent it. The honeypot fields are verified before this schema runs.
 *
 * @param locale The language the page was read in.
 * @returns The schema for that language.
 */
export function encoreSupportSchema(locale: EncoreLocale) {
	let messages = MESSAGES[locale];
	return f.object({
		name: line(SUPPORT_LIMITS.name, messages.tooLong("name"), messages.oneLine("name")),
		email: f.field(
			defaulted(string(), "")
				.transform((value) => value.trim())
				.refine((value) => value.length > 0, messages.emailMissing)
				.refine((value) => value.length <= SUPPORT_LIMITS.email, messages.emailTooLong)
				.refine(
					(value) => value.length === 0 || replyAddress(value) !== null,
					messages.emailInvalid,
				)
				.transform((value) => replyAddress(value) ?? value),
		),
		topic: choice(SUPPORT_TOPICS, messages.topic),
		platform: choice(SUPPORT_PLATFORMS, messages.platform),
		osVersion: line(SUPPORT_LIMITS.version, messages.tooLong("os"), messages.oneLine("os")),
		appVersion: line(SUPPORT_LIMITS.version, messages.tooLong("app"), messages.oneLine("app")),
		message: f.field(
			defaulted(string(), "")
				.transform((value) => value.trim())
				.refine((value) => value.length > 0, messages.messageMissing)
				.refine(
					(value) => value.length === 0 || value.length >= SUPPORT_MESSAGE_MIN,
					messages.messageTooShort,
				)
				.refine((value) => value.length <= SUPPORT_LIMITS.message, messages.messageTooLong),
		),
	});
}

/** The schema in English, whose output every language's schema shares. */
export const SupportRequestSchema = encoreSupportSchema("en");

/** A validated support request, ready to be mailed. */
export type SupportRequest = InferOutput<typeof SupportRequestSchema>;
