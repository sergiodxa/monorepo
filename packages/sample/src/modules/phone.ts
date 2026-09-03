/**
 * Phone numbers, drawn from the `555-01xx` range reserved for fiction, so a
 * generated number rings nobody however it is formatted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Random } from "../random";

/**
 * The area code every style writes. 555 is not a dialable area code, so a
 * generated number is fictional whichever format it is written in.
 */
const AREA_CODE = "555";

/** How a number is written. */
export type PhoneStyle = "human" | "national" | "international";

/** Options for a phone number. */
export interface PhoneNumberOptions {
	/** `"human"` by default: `555-0142`. */
	style?: PhoneStyle;
}

/** Phone numbers and device identifiers. */
export interface PhoneModule {
	/** A number in the range reserved for fiction, written in the chosen style. */
	number(options?: PhoneNumberOptions): string;
	/** A 15-digit IMEI, its last digit the Luhn check digit. */
	imei(): string;
}

/**
 * The Luhn check digit that completes a number: the doubling runs from the
 * payload's last digit, since the check digit itself is never doubled.
 */
function luhnCheckDigit(digits: string): number {
	let sum = 0;
	let double = true;
	for (let index = digits.length - 1; index >= 0; index--) {
		let digit = Number(digits.charAt(index));
		if (double) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		double = !double;
		sum += digit;
	}
	return (10 - (sum % 10)) % 10;
}

/** Create the `phone` module over one stream. */
export function createPhoneModule(random: Random): PhoneModule {
	return {
		number(options = {}) {
			let line = String(random.int(0, 99)).padStart(2, "0");
			if (options.style === "national") return `(${AREA_CODE}) 555-01${line}`;
			if (options.style === "international") return `+1 ${AREA_CODE}-555-01${line}`;
			return `555-01${line}`;
		},
		imei() {
			let digits = Array.from({ length: 14 }, () => String(random.int(0, 9))).join("");
			return `${digits}${luhnCheckDigit(digits)}`;
		},
	};
}
