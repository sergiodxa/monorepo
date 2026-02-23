---
title: Signing Webhooks with HMAC for Notification Security
excerpt: Shared secrets and HMAC signatures prevent alert spoofing on webhook endpoints.
---

You've built a webhook endpoint to receive alerts from your monitoring system. It works great: alerts come in, your system processes them, and the right people get notified. Then someone discovers the endpoint URL and starts sending fake alerts. Suddenly your on-call engineer is responding to phantom incidents at 3 AM.

This is the webhook security problem. When you expose an HTTP endpoint to receive data, how do you verify that the request actually came from a trusted source?

## The Problem with Open Endpoints

A webhook endpoint is just a URL that accepts POST requests. Anyone who knows the URL can send requests to it. Security through obscurity (using a hard-to-guess URL) isn't security at all: URLs leak through logs, browser history, and network inspection.

Without verification, an attacker can:

**Spoof alerts**: Send fake critical alerts that trigger incident response, wasting engineering time and [creating alert fatigue](/articles/designing-alerts-that-do-not-cause-fatigue).

**Inject malicious data**: If your webhook processing has vulnerabilities, crafted payloads could exploit them.

**Denial of service**: Flood your endpoint with requests, overwhelming your notification system.

**Social engineering**: Send convincing fake alerts that trick engineers into taking harmful actions.

The solution is cryptographic verification: a way for your endpoint to confirm that each request came from your monitoring system and hasn't been tampered with.

## HMAC: The Standard Solution

HMAC (Hash-based Message Authentication Code) is the standard approach for webhook signing. It works like this:

1. You and the webhook sender share a secret key
2. The sender computes a hash of the request body using this key
3. The sender includes this hash in a request header
4. Your endpoint computes the same hash and compares it to the header
5. If they match, the request is authentic

The key insight is that only someone with the secret key can produce a valid hash. An attacker who intercepts a request can see the hash but can't forge a new one for a different payload without knowing the key.

## Implementing Signature Verification

Here's how to verify HMAC signatures in a webhook endpoint:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

interface WebhookVerificationResult {
	valid: boolean;
	error?: string;
}

function verifyWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): WebhookVerificationResult {
	if (!signature) {
		return { valid: false, error: "Missing signature header" };
	}

	const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");

	const signatureBuffer = Buffer.from(signature, "hex");
	const expectedBuffer = Buffer.from(expectedSignature, "hex");

	if (signatureBuffer.length !== expectedBuffer.length) {
		return { valid: false, error: "Invalid signature length" };
	}

	if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
		return { valid: false, error: "Signature mismatch" };
	}

	return { valid: true };
}
```

The `timingSafeEqual` function is critical. A naive string comparison like `signature === expectedSignature` is vulnerable to timing attacks, where an attacker can guess the signature byte-by-byte by measuring response times. Timing-safe comparison takes constant time regardless of where the mismatch occurs.

## Using It in a Request Handler

Here's how you'd use this verification in a webhook handler:

```ts
import type { Route } from "./+types/webhook";

export async function action({ request, context }: Route.ActionArgs) {
	const signature = request.headers.get("X-Webhook-Signature");
	const payload = await request.text();

	const result = verifyWebhookSignature(payload, signature ?? "", context.env.WEBHOOK_SECRET);

	if (!result.valid) {
		console.warn("Webhook verification failed", { error: result.error });
		return new Response("Unauthorized", { status: 401 });
	}

	const alert = JSON.parse(payload);
	await processAlert(alert);

	return new Response("OK", { status: 200 });
}
```

Note that we read the request body as text, not JSON. The signature is computed over the raw bytes, so we need to verify before parsing.

## Generating Signatures on the Sender Side

If you're building the webhook sender, here's how to generate signatures:

```ts
import { createHmac } from "node:crypto";

interface WebhookPayload {
	alertId: string;
	severity: string;
	message: string;
	timestamp: string;
}

async function sendWebhook(
	url: string,
	payload: WebhookPayload,
	secret: string,
): Promise<Response> {
	const body = JSON.stringify(payload);

	const signature = createHmac("sha256", secret).update(body).digest("hex");

	return fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Webhook-Signature": signature,
		},
		body,
	});
}
```

The signature must be computed over exactly the same bytes that will be sent. If you modify the payload after signing, verification will fail.

## Adding Timestamp Validation

HMAC signatures prevent forgery but don't prevent replay attacks. An attacker who captures a valid signed request can resend it later. To prevent this, include a timestamp in the payload and reject old requests:

```ts
interface SignedPayload {
	timestamp: string;
	data: unknown;
}

function verifyTimestamp(timestamp: string, maxAgeSeconds: number = 300): boolean {
	const requestTime = new Date(timestamp).getTime();
	const now = Date.now();
	const age = Math.abs(now - requestTime);

	return age <= maxAgeSeconds * 1000;
}

function verifyWebhookWithTimestamp(
	payload: string,
	signature: string,
	secret: string,
): WebhookVerificationResult {
	const signatureResult = verifyWebhookSignature(payload, signature, secret);

	if (!signatureResult.valid) {
		return signatureResult;
	}

	const parsed = JSON.parse(payload) as SignedPayload;

	if (!verifyTimestamp(parsed.timestamp)) {
		return { valid: false, error: "Request timestamp too old" };
	}

	return { valid: true };
}
```

A 5-minute window (300 seconds) is typical. It's long enough to handle clock skew and network delays, but short enough that captured requests can't be replayed much later.

## Secret Management

The security of HMAC depends entirely on the secrecy of the shared key. If the key is compromised, an attacker can forge valid signatures.

Best practices for webhook secrets:

**Generate strong secrets**: Use cryptographically random bytes, not human-memorable passwords. At least 32 bytes (256 bits) is recommended. For more on secure hashing, see the tutorial on [implementing API key authentication with SHA-256](/tutorials/implement-api-key-authentication-with-sha-256).

```ts
import { randomBytes } from "node:crypto";

const secret = randomBytes(32).toString("hex");
```

**Store secrets securely**: Use environment variables or a secrets manager. Never commit secrets to version control.

**Rotate secrets periodically**: Change secrets on a schedule and whenever you suspect compromise. Your webhook system should support multiple active secrets during rotation.

**Use different secrets per integration**: If you have multiple webhook senders, each should have its own secret. A compromise of one doesn't affect others.

## Handling Multiple Secrets During Rotation

During secret rotation, you need to accept signatures from both the old and new secrets:

```ts
function verifyWithMultipleSecrets(
	payload: string,
	signature: string,
	secrets: string[],
): WebhookVerificationResult {
	for (const secret of secrets) {
		const result = verifyWebhookSignature(payload, signature, secret);
		if (result.valid) {
			return result;
		}
	}

	return { valid: false, error: "No valid signature found" };
}
```

This allows you to add a new secret, update the sender to use it, verify everything works, then remove the old secret.

## Common Pitfalls

**Signing the wrong data**: The signature must be computed over exactly the bytes that are sent. If you sign a JavaScript object and then serialize it differently when sending, verification fails.

**Encoding mismatches**: Ensure both sides use the same encoding for the signature (typically hex or base64) and the same character encoding for the payload (typically UTF-8).

**Missing timing-safe comparison**: Always use `timingSafeEqual` or equivalent. Regular string comparison leaks information through timing.

**Logging secrets**: Be careful not to log the secret or valid signatures. Log verification failures, but not the expected signature.

**Trusting the signature header format**: Some systems prefix signatures with algorithm identifiers like `sha256=`. Make sure your verification handles the exact format your sender uses.

## Beyond HMAC

For high-security scenarios, consider asymmetric signatures using public/private key pairs. The sender signs with a private key, and you verify with the corresponding public key. This eliminates the need to share secrets, but adds complexity.

For most webhook use cases, HMAC with a strong shared secret provides adequate security. The important thing is having some verification rather than accepting unsigned requests. If you're building OAuth integrations instead, see [OAuth2 tokens explained](/articles/oauth2-tokens-explained) for a different approach to API security.

Your webhook endpoints are part of your security perimeter. Treat them accordingly.
