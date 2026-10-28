/**
 * Facilitator clients: HTTP for production verify/settle, and an in-memory double that
 * accepts any well-formed payload so tests and local dev never need a chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { readText } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

import type {
	PaymentPayload,
	PaymentRequirements,
	SettleResponse,
	VerifyResponse,
} from "./types.js";

import { X402Error } from "./errors.js";

/** Verifies and settles payment payloads on behalf of a resource server. */
export interface Facilitator {
	/**
	 * Checks a payload against requirements without moving funds.
	 *
	 * @param paymentPayload - Client payment signature body
	 * @param paymentRequirements - The accept entry being paid
	 */
	verify(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<Result<VerifyResponse, X402Error>>;

	/**
	 * Submits a verified payload for on-chain (or simulated) settlement.
	 *
	 * @param paymentPayload - Client payment signature body
	 * @param paymentRequirements - The accept entry being paid
	 */
	settle(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<Result<SettleResponse, X402Error>>;
}

/** Options for {@link HTTPFacilitator}. */
export interface HTTPFacilitatorOptions {
	/** Facilitator base URL, without a trailing slash. */
	url: string;
	/** Per-request deadline in milliseconds. @default 30_000 */
	timeoutMs?: number;
	/**
	 * Extra headers on every `/verify` and `/settle` call (for example a CDP
	 * `Authorization` bearer). Never log these values.
	 */
	headers?: HeadersInit;
}

/**
 * Calls a facilitator's `/verify` and `/settle` over HTTP.
 */
export class HTTPFacilitator implements Facilitator {
	readonly #url: string;
	readonly #timeoutMs: number;
	readonly #headers: HeadersInit | undefined;

	/**
	 * @param options - Facilitator URL, timeout and optional auth headers
	 */
	constructor(options: HTTPFacilitatorOptions) {
		this.#url = options.url.replace(/\/$/, "");
		this.#timeoutMs = options.timeoutMs ?? 30_000;
		this.#headers = options.headers;
	}

	/** @inheritdoc */
	async verify(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<Result<VerifyResponse, X402Error>> {
		return this.#post<VerifyResponse>("/verify", {
			x402Version: paymentPayload.x402Version,
			paymentPayload,
			paymentRequirements,
		});
	}

	/** @inheritdoc */
	async settle(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<Result<SettleResponse, X402Error>> {
		return this.#post<SettleResponse>("/settle", {
			x402Version: paymentPayload.x402Version,
			paymentPayload,
			paymentRequirements,
		});
	}

	/**
	 * POSTs JSON to a facilitator path and reads a JSON body.
	 *
	 * @param path - Path under the facilitator origin
	 * @param body - JSON body
	 */
	async #post<T>(path: string, body: unknown): Promise<Result<T, X402Error>> {
		let response: Response;
		try {
			let headers = new Headers(this.#headers);
			headers.set("content-type", "application/json");
			headers.set("accept", "application/json");
			response = await fetch(new URL(path, `${this.#url}/`), {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(this.#timeoutMs),
			});
		} catch {
			return failure(
				new X402Error("facilitator_unreachable", `Facilitator ${this.#url}${path} did not answer`),
			);
		}

		let text = await readText(response, { maxBytes: 64 * 1024 });
		if (isFailure(text)) {
			return failure(
				new X402Error("facilitator_unreachable", `Facilitator ${path} body could not be read`),
			);
		}

		if (!response.ok) {
			return failure(
				new X402Error(
					"facilitator_rejected",
					`Facilitator ${path} answered ${String(response.status)}: ${text.data.text.slice(0, 200)}`,
				),
			);
		}

		try {
			return success(JSON.parse(text.data.text) as T);
		} catch {
			return failure(
				new X402Error("facilitator_rejected", `Facilitator ${path} returned non-JSON`),
			);
		}
	}
}

/**
 * Settles any payload whose `accepted` matches the requirements amount and network.
 * Used in tests and local development; never in production mainnet config.
 */
export class MemoryFacilitator implements Facilitator {
	/** Running counter so each simulated settlement gets a distinct transaction id. */
	#settlements = 0;

	/** @inheritdoc */
	async verify(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<Result<VerifyResponse, X402Error>> {
		let mismatch = this.#mismatch(paymentPayload, paymentRequirements);
		if (mismatch !== null) {
			return success({
				isValid: false,
				invalidReason: "requirement_mismatch",
				invalidMessage: mismatch,
			});
		}

		return success({
			isValid: true,
			payer:
				typeof paymentPayload.payload.payer === "string"
					? paymentPayload.payload.payer
					: "0xmemory",
		});
	}

	/** @inheritdoc */
	async settle(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): Promise<Result<SettleResponse, X402Error>> {
		let verified = await this.verify(paymentPayload, paymentRequirements);
		if (isFailure(verified)) return verified;
		if (!verified.data.isValid) {
			return success({
				success: false,
				errorReason: verified.data.invalidReason,
				errorMessage: verified.data.invalidMessage,
				transaction: "",
				network: paymentRequirements.network,
			});
		}

		this.#settlements += 1;
		return success({
			success: true,
			payer: verified.data.payer,
			transaction: `memory-${String(this.#settlements)}`,
			network: paymentRequirements.network,
			amount: paymentRequirements.amount,
		});
	}

	/**
	 * Describes why a payload does not match the requirements, or `null` when it does.
	 *
	 * @param paymentPayload - Client payload
	 * @param paymentRequirements - Expected accept entry
	 */
	#mismatch(
		paymentPayload: PaymentPayload,
		paymentRequirements: PaymentRequirements,
	): string | null {
		let accepted = paymentPayload.accepted;
		if (accepted.amount !== paymentRequirements.amount) return "amount does not match";
		if (accepted.network !== paymentRequirements.network) return "network does not match";
		if (accepted.asset !== paymentRequirements.asset) return "asset does not match";
		if (accepted.payTo !== paymentRequirements.payTo) return "payTo does not match";
		if (accepted.scheme !== paymentRequirements.scheme) return "scheme does not match";
		return null;
	}
}
