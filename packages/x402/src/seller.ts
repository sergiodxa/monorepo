/**
 * Seller helpers: build a 402 challenge and verify+settle a request that carries
 * `PAYMENT-SIGNATURE`, returning a receipt when funds clear.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { currentLog } from "@sdxc/logger";
import { failure, isFailure, success } from "@sdxc/result";

import type { Facilitator } from "./facilitator.js";
import type {
	PaymentReceipt,
	PaymentRequired,
	PaymentRequirements,
	ResourceInfo,
	SettleResponse,
} from "./types.js";

import { X402Error } from "./errors.js";
import {
	PAYMENT_REQUIRED,
	PAYMENT_REQUIRED_CACHE_CONTROL,
	PAYMENT_RESPONSE,
	PAYMENT_SIGNATURE,
	decodePaymentSignature,
	encodePaymentRequired,
	encodePaymentResponse,
} from "./headers.js";

/** Default seconds a client may take to attach a signature and retry. */
const DEFAULT_MAX_TIMEOUT_SECONDS = 60;

/** Wallet and network defaults shared by every priced resource on one seller. */
export interface SellerConfig {
	/** Facilitator that verifies and settles. */
	facilitator: Facilitator;
	/** Destination wallet. */
	payTo: string;
	/** CAIP-2 network id. */
	network: string;
	/** Asset contract / id charged. */
	asset: string;
	/** Payment scheme. @default "exact" */
	scheme?: string;
	/** Max seconds advertised on each challenge. @default 60 */
	maxTimeoutSeconds?: number;
	/** Optional service name stamped on every resource. */
	serviceName?: string;
}

/** Per-call price and resource description. */
export interface PriceRequest {
	/** Atomic token amount as a decimal string. */
	amount: string;
	/** What the caller is buying. */
	resource: ResourceInfo;
	/** Optional scheme-specific extra fields. */
	extra?: Record<string, unknown>;
}

/**
 * Builds payment requirements and 402 responses for one receive wallet and network.
 */
export class Seller {
	readonly #facilitator: Facilitator;
	readonly #payTo: string;
	readonly #network: string;
	readonly #asset: string;
	readonly #scheme: string;
	readonly #maxTimeoutSeconds: number;
	readonly #serviceName: string | undefined;

	/**
	 * @param config - Wallet, network and facilitator
	 */
	constructor(config: SellerConfig) {
		this.#facilitator = config.facilitator;
		this.#payTo = config.payTo;
		this.#network = config.network;
		this.#asset = config.asset;
		this.#scheme = config.scheme ?? "exact";
		this.#maxTimeoutSeconds = config.maxTimeoutSeconds ?? DEFAULT_MAX_TIMEOUT_SECONDS;
		this.#serviceName = config.serviceName;
	}

	/**
	 * Builds the accept entry for one priced call.
	 *
	 * @param amount - Atomic amount
	 * @param extra - Optional scheme extras
	 */
	requirements(amount: string, extra?: Record<string, unknown>): PaymentRequirements {
		return {
			scheme: this.#scheme,
			network: this.#network,
			amount,
			asset: this.#asset,
			payTo: this.#payTo,
			maxTimeoutSeconds: this.#maxTimeoutSeconds,
			extra: extra ?? null,
		};
	}

	/**
	 * Builds a `PaymentRequired` body for one resource.
	 *
	 * @param price - Amount and resource info
	 */
	paymentRequired(price: PriceRequest): PaymentRequired {
		let resource: ResourceInfo = {
			...price.resource,
			serviceName: price.resource.serviceName ?? this.#serviceName,
		};
		return {
			x402Version: 2,
			resource,
			accepts: [this.requirements(price.amount, price.extra)],
		};
	}

	/**
	 * Answers `402 Payment Required` with the encoded challenge.
	 *
	 * @param price - Amount and resource info
	 * @param error - Optional reason when re-challenging after a failed settle
	 */
	challenge(price: PriceRequest, error?: string): Response {
		let body = this.paymentRequired(price);
		if (error !== undefined) body = { ...body, error };
		return new Response(null, {
			status: 402,
			headers: {
				[PAYMENT_REQUIRED]: encodePaymentRequired(body),
				"Cache-Control": PAYMENT_REQUIRED_CACHE_CONTROL,
			},
		});
	}

	/**
	 * Reads `PAYMENT-SIGNATURE`, verifies and settles through the facilitator.
	 *
	 * @param request - Incoming request that may carry a signature
	 * @param price - Expected price for this resource
	 * @returns A receipt on success, or a failure the caller turns into a 402
	 */
	async collect(request: Request, price: PriceRequest): Promise<Result<PaymentReceipt, X402Error>> {
		let header = request.headers.get(PAYMENT_SIGNATURE);
		if (header === null || header.trim() === "") {
			return failure(new X402Error("invalid_payload", "PAYMENT-SIGNATURE header is missing"));
		}

		let payload = decodePaymentSignature(header);
		if (isFailure(payload)) return payload;

		let requirements = this.requirements(price.amount, price.extra);
		let verified = await this.#facilitator.verify(payload.data, requirements);
		if (isFailure(verified)) return verified;
		if (!verified.data.isValid) {
			currentLog()?.warn("x402.verify_failed", {
				reason: verified.data.invalidReason,
				message: verified.data.invalidMessage,
			});
			return failure(
				new X402Error(
					"facilitator_rejected",
					verified.data.invalidMessage ?? verified.data.invalidReason ?? "Payment invalid",
				),
			);
		}

		let settled = await this.#facilitator.settle(payload.data, requirements);
		if (isFailure(settled)) return settled;
		if (!settled.data.success) {
			currentLog()?.warn("x402.settle_failed", {
				reason: settled.data.errorReason,
				message: settled.data.errorMessage,
			});
			return failure(
				new X402Error(
					"settlement_failed",
					settled.data.errorMessage ?? settled.data.errorReason ?? "Settlement failed",
				),
			);
		}

		currentLog()?.note("x402.settled", {
			transaction: settled.data.transaction,
			network: settled.data.network,
			amount: settled.data.amount ?? requirements.amount,
			payer: settled.data.payer,
		});

		return success({
			payer: settled.data.payer,
			transaction: settled.data.transaction,
			network: settled.data.network,
			amount: settled.data.amount ?? requirements.amount,
			asset: requirements.asset,
			scheme: requirements.scheme,
		});
	}

	/**
	 * Attaches `PAYMENT-RESPONSE` to a successful resource response.
	 *
	 * @param response - The resource response
	 * @param settlement - Facilitator settle body to encode
	 */
	withPaymentResponse(response: Response, settlement: SettleResponse): Response {
		let headers = new Headers(response.headers);
		headers.set(PAYMENT_RESPONSE, encodePaymentResponse(settlement));
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}
}
