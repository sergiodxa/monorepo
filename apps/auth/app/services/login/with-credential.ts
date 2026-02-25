import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { failure } from "@pkg/result";
import bcrypt from "bcryptjs";

import { MissingValidationError } from "~/errors";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Credential from "~/models/credential";
import Subject from "~/models/subject";

import generateAuthzCode from "./generate-code";

interface Input {
	email: string;
	password: string;
	name: string;
	username: string;
	clientId: string;
	ip: string | null;
	ua: string | null;
	redirectUri: string;
	state: string;
	nonce?: string;
	scope?: string[];
	opBrowserState?: string;
	responseMode?: "query" | "fragment" | "form_post";
}

/**
 * Complete OAuth login flow with email/password credentials.
 * Creates a new subject if one doesn't exist.
 */
export default async function loginWithCredential(input: Input) {
	let subject = await Subject.findByEmail(db(), input.email);

	if (subject) {
		let credential = await Credential.find(db(), subject.id);

		if (credential?.verifiedAt === null) {
			logger.info("login_email_verification_required", { subjectId: subject.id });
			return failure(new MissingValidationError("Verify your email address."));
		}

		if (!credential) {
			await Credential.create(db(), subject.id, await bcrypt.hash(input.password, 10));
			logger.info("credential_created", { subjectId: subject.id });
			return failure(new MissingValidationError("Verify your email address."));
		}
	} else {
		let emailHash = encodeHexLowerCase(sha256(new TextEncoder().encode(input.email)));

		subject = await Subject.create(db(), {
			emailAddress: input.email,
			displayName: input.name,
			avatar: `https://gravatar.com/avatar/${emailHash}`,
			username: input.username,
		});

		await Credential.create(db(), subject.id, await bcrypt.hash(input.password, 10));
		logger.info("subject_created", { subjectId: subject.id, email: input.email });
	}

	let result = await generateAuthzCode({
		subjectId: subject.id,
		clientId: input.clientId,
		ip: input.ip,
		ua: input.ua,
		redirectUri: input.redirectUri,
		state: input.state,
		nonce: input.nonce,
		scope: input.scope,
		opBrowserState: input.opBrowserState,
		responseMode: input.responseMode,
	});

	if (result.status === "success") {
		logger.info("credential_login_success", { subjectId: subject.id });
	}

	return result;
}
