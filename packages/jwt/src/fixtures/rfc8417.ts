/**
 * Security Event Tokens from RFC 8417's figures, RFC 8935's transmission example and RFC
 * 9493's subject identifiers, as the RFCs print them, so `SecurityEventToken` is checked
 * against the specifications' own examples.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** RFC 8417 Figure 1: a SCIM password reset with an extension event. */
export const SCIM_PASSWORD_RESET = {
	iss: "https://scim.example.com",
	iat: 1458496025,
	jti: "3d0c3cf797584bd193bd0fb1bd4e7d30",
	aud: [
		"https://jhub.example.com/Feeds/98d52461fa5bbc879593b7754",
		"https://jhub.example.com/Feeds/5d7604516b1d08641d7676ee7",
	],
	sub: "https://scim.example.com/Users/44f6142df96bd6ab61e7521d9",
	events: {
		"urn:ietf:params:scim:event:passwordReset": { id: "44f6142df96bd6ab61e7521d9" },
		"https://example.com/scim/event/passwordResetExt": { resetAttempts: 5 },
	},
};

/** RFC 8417 Figure 2: an OpenID Back-Channel Logout event with an empty payload. */
export const BACKCHANNEL_LOGOUT = {
	iss: "https://server.example.com",
	sub: "248289761001",
	aud: "s6BhdRkqt3",
	iat: 1471566154,
	jti: "bWJq",
	sid: "08a5019c-17e1-4977-8f42-65a12843ea02",
	events: { "http://schemas.openid.net/event/backchannel-logout": {} },
};

/** RFC 8417 Figure 3: a consent event whose payload `iss` names the subject's issuer. */
export const CONSENT = {
	iss: "https://my.med.example.org",
	iat: 1458496025,
	jti: "fb4e75b5411e4e19b6c0fe87950f7749",
	aud: ["https://rp.example.com"],
	events: {
		"https://openid.net/heart/specs/consent.html": {
			iss: "https://connect.example.com",
			sub: "248289761001",
			consentUri: ["https://terms.med.example.org/labdisclosure.html#Agree"],
		},
	},
};

/** RFC 8417 Figure 4: a RISC account-disabled event. */
export const RISC_ACCOUNT_DISABLED = {
	iss: "https://idp.example.com/",
	jti: "756E69717565206964656E746966696572",
	iat: 1508184845,
	aud: "636C69656E745F6964",
	events: {
		"https://schemas.openid.net/secevent/risc/event-type/account-disabled": {
			subject: { subject_type: "iss-sub", iss: "https://idp.example.com/", sub: "7375626A656374" },
			reason: "hijacking",
		},
	},
};

/** RFC 8417 Figure 5: the SCIM create event Figure 6 encodes. */
export const SCIM_CREATE = {
	iss: "https://scim.example.com",
	iat: 1458496404,
	jti: "4d3559ec67504aaba65d40b0363faad8",
	aud: [
		"https://scim.example.com/Feeds/98d52461fa5bbc879593b7754",
		"https://scim.example.com/Feeds/5d7604516b1d08641d7676ee7",
	],
	events: {
		"urn:ietf:params:scim:event:create": {
			ref: "https://scim.example.com/Users/44f6142df96bd6ab61e7521d9",
			attributes: ["id", "name", "userName", "password", "emails"],
		},
	},
};

/** RFC 8417 Figure 6: Figure 5 as an unsecured SET typed `secevent+jwt`. */
export const UNSECURED_SCIM_CREATE = [
	"eyJ0eXAiOiJzZWNldmVudCtqd3QiLCJhbGciOiJub25lIn0",
	"eyJpc3MiOiJodHRwczovL3NjaW0uZXhhbXBsZS5jb20iLCJpYXQiOjE0NTg0OTY0M" +
		"DQsImp0aSI6IjRkMzU1OWVjNjc1MDRhYWJhNjVkNDBiMDM2M2ZhYWQ4IiwiYXVkIj" +
		"pbImh0dHBzOi8vc2NpbS5leGFtcGxlLmNvbS9GZWVkcy85OGQ1MjQ2MWZhNWJiYzg" +
		"3OTU5M2I3NzU0IiwiaHR0cHM6Ly9zY2ltLmV4YW1wbGUuY29tL0ZlZWRzLzVkNzYw" +
		"NDUxNmIxZDA4NjQxZDc2NzZlZTciXSwiZXZlbnRzIjp7InVybjppZXRmOnBhcmFtc" +
		"zpzY2ltOmV2ZW50OmNyZWF0ZSI6eyJyZWYiOiJodHRwczovL3NjaW0uZXhhbXBsZS" +
		"5jb20vVXNlcnMvNDRmNjE0MmRmOTZiZDZhYjYxZTc1MjFkOSIsImF0dHJpYnV0ZXM" +
		"iOlsiaWQiLCJuYW1lIiwidXNlck5hbWUiLCJwYXNzd29yZCIsImVtYWlscyJdfX19",
	"",
].join(".");

/** RFC 8935 Figure 1: the HS256 RISC SET a transmitter POSTs, carrying Figure 4's claims. */
export const TRANSMITTED_RISC_EVENT = [
	"eyJ0eXAiOiJzZWNldmVudCtqd3QiLCJhbGciOiJIUzI1NiJ9Cg",
	"eyJpc3MiOiJodHRwczovL2lkcC5leGFtcGxlLmNvbS8iLCJqdGkiOiI3NTZFNjk" +
		"3MTc1NjUyMDY5NjQ2NTZFNzQ2OTY2Njk2NTcyIiwiaWF0IjoxNTA4MTg0ODQ1LC" +
		"JhdWQiOiI2MzZDNjk2NTZFNzQ1RjY5NjQiLCJldmVudHMiOnsiaHR0cHM6Ly9zY" +
		"2hlbWFzLm9wZW5pZC5uZXQvc2VjZXZlbnQvcmlzYy9ldmVudC10eXBlL2FjY291" +
		"bnQtZGlzYWJsZWQiOnsic3ViamVjdCI6eyJzdWJqZWN0X3R5cGUiOiJpc3Mtc3V" +
		"iIiwiaXNzIjoiaHR0cHM6Ly9pZHAuZXhhbXBsZS5jb20vIiwic3ViIjoiNzM3NT" +
		"YyNkE2NTYzNzQifSwicmVhc29uIjoiaGlqYWNraW5nIn19fQ",
	"Y4rXxMD406P2edv00cr9Wf3_XwNtLjB9n-jTqN1_lLc",
].join(".");

/** RFC 9493 Figure 5: an `email` subject identifier. */
export const EMAIL_SUBJECT = { format: "email", email: "user@example.com" } as const;

/** RFC 9493 Figure 6: an `iss_sub` subject identifier. */
export const ISSUER_SUBJECT = {
	format: "iss_sub",
	iss: "https://issuer.example.com/",
	sub: "145234573",
} as const;

/** RFC 9493 Figure 7: an `opaque` subject identifier. */
export const OPAQUE_SUBJECT = { format: "opaque", id: "11112222333344445555" } as const;

/** RFC 9493 Figure 8: a `phone_number` subject identifier, a format read as given. */
export const PHONE_SUBJECT = { format: "phone_number", phone_number: "+12065550100" } as const;
