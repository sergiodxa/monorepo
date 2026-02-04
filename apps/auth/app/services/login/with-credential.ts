import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import bcrypt from "bcryptjs";

import { failure, success } from "~/helpers/result";
import { db } from "~/middleware/drizzle";
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
}

export default async function loginWithCredential(input: Input) {
	let subject = await Subject.findByEmail(db(), input.email);

	if (subject) {
		let credential = await Credential.find(db(), subject.id);

		if (credential) {
			if (credential.verifiedAt === null) {
				return failure("missing_validation", "Verify your email address.");
			}
		}

		if (!credential) {
			await Credential.create(db(), subject.id, await bcrypt.hash(input.password, 10));

			return failure("missing_validation", "Verify your email address.");
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
	}

	let result = await generateCode({
		subjectId: subject.id,
		clientId: input.clientId,
		ip: input.ip,
		ua: input.ua,
	});

	if (result.status === "failure") return result;

	let url = new URL(input.redirectUri);
	url.searchParams.set("state", input.state);
	url.searchParams.set("code", result.payload.code);

	return success({ url, subjectId: subject.id });
}
