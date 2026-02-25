import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { failure, isFailure, success } from "@pkg/result";
import bcrypt from "bcryptjs";

import { ISSUER } from "~/config";
import { MissingValidationError } from "~/errors";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Credential from "~/models/credential";
import Subject from "~/models/subject";

import generateCode from "./generate-code";

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
}

export default async function loginWithCredential(input: Input) {
	let subject = await Subject.findByEmail(db(), input.email);

	if (subject) {
		let credential = await Credential.find(db(), subject.id);

		if (credential) {
			if (credential.verifiedAt === null) {
				logger.info("login_email_verification_required", { subjectId: subject.id });
				return failure(new MissingValidationError("Verify your email address."));
			}
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

	let result = await generateCode({
		subjectId: subject.id,
		clientId: input.clientId,
		ip: input.ip,
		ua: input.ua,
		nonce: input.nonce,
	});

	if (isFailure(result)) return result;

	logger.info("login_code_generated", { subjectId: subject.id });
	let url = new URL(input.redirectUri);
	url.searchParams.set("state", input.state);
	url.searchParams.set("iss", ISSUER); // RFC 9207
	url.searchParams.set("code", result.data.code);

	return success({ url, subjectId: subject.id });
}
