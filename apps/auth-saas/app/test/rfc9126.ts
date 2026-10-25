/**
 * The examples RFC 9126 (Pushed Authorization Requests) prints, verbatim: the authorization
 * request §2.1 pushes, the request object §3 pushes instead, and the RSA key pair §3
 * publishes so a reader can check or recreate that object's signature.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The client every example names. */
export const RFC9126_CLIENT_ID = "s6BhdRkqt3";

/** The authorization server the examples address, the audience the request object names. */
export const RFC9126_ISSUER = "https://server.example.com";

/** The redirect URI the examples register and request. */
export const RFC9126_REDIRECT_URI = "https://client.example.org/cb";

/** The authorization parameters §2.1 pushes, without the client assertion the example authenticates with. */
export const RFC9126_PARAMETERS = {
	response_type: "code",
	state: "af0ifjsldkj",
	client_id: RFC9126_CLIENT_ID,
	redirect_uri: RFC9126_REDIRECT_URI,
	code_challenge: "K2-ltc83acc4h0c9w6ESC_rEMTJ3bww-uCHaoeK1t8U",
	code_challenge_method: "S256",
	scope: "account-information",
};

/** The §3 request object's `exp`, in seconds: the object verifies only before this instant. */
export const RFC9126_REQUEST_OBJECT_EXP = 1625869677;

/** The §3 request object, signed RS256 under `k2bdc` with no `typ` header. */
export const RFC9126_REQUEST_OBJECT = [
	"eyJraWQiOiJrMmJkYyIsImFsZyI6IlJTMjU2In0.eyJpc3MiOiJzNkJoZFJrcXQzIiwiYXVkIjoi",
	"aHR0cHM6Ly9zZXJ2ZXIuZXhhbXBsZS5jb20iLCJleHAiOjE2MjU4Njk2NzcsInJlc3BvbnNlX3R5",
	"cGUiOiJjb2RlIiwiY2xpZW50X2lkIjoiczZCaGRSa3F0MyIsInJlZGlyZWN0X3VyaSI6Imh0dHBz",
	"Oi8vY2xpZW50LmV4YW1wbGUub3JnL2NiIiwic2NvcGUiOiJhY2NvdW50LWluZm9ybWF0aW9uIiwi",
	"c3RhdGUiOiJhZjBpZmpzbGRraiIsImNvZGVfY2hhbGxlbmdlIjoiSzItbHRjODNhY2M0aDBjOXc2",
	"RVNDX3JFTVRKM2J3dy11Q0hhb2VLMXQ4VSIsImNvZGVfY2hhbGxlbmdlX21ldGhvZCI6IlMyNTYi",
	"fQ.l9R3RC9bFBHry_8acObQjEf4fX5yfJkWUPfak3J3iiBm0aaQznPw5BZ0B3VQZ9_KYdPt5bTka",
	"flS5fSDklM3_7my9MyOSKFYmf46INk6ju_qUuC2crkOQXZWYJB-0bnYEbdHpUjazFSUvN49cEGst",
	"NQeE-dKDWHNgEojgcuNA_pjKfL9VYp1dEA6-WjXZ_OlJ7R_mBWpjFAzc0UkQwqX5hfOJoGTqB2tE",
	"4a4aB2z8iYlUJp0DeeYp_hPN6svtmdvte73p5bLGDFpRIlmrBQIAQuxiS0skORpXlS0cBcgHimXV",
	"nXOJG7E-A_lS_5y54dVLQPA1jKYx-fxbYSG7dp2fw",
].join("");

/** The §3 RSA key pair, private members included, that signed {@link RFC9126_REQUEST_OBJECT}. */
export const RFC9126_PRIVATE_JWK = {
	kty: "RSA",
	kid: "k2bdc",
	n: [
		"y9Lqv4fCp6Ei-u2-ZCKq83YvbFEk6JMs_pSj76eMkddWRuWX2aBKGHAtKlE5P7_vn__PCKZWePt3",
		"vGkB6ePgzAFu08NmKemwE5bQI0e6kIChtt_6KzT5OaaXDFI6qCLJmk51Cc4VYFaxgqevMncYrzaW",
		"_50mZ1yGSFIQzLYP8bijAHGVjdEFgZaZEN9lsn_GdWLaJpHrB3ROlS50E45wxrlg9xMncVb8qDPu",
		"XZarvghLL0HzOuYRadBJVoWZowDNTpKpk2RklZ7QaBO7XDv3uR7s_sf2g-bAjSYxYUGsqkNA9b3x",
		"VW53am_UZZ3tZbFTIh557JICWKHlWj5uzeJXaw",
	].join(""),
	e: "AQAB",
	d: [
		"LNwG_pCKrwowALpCpRdcOKlSVqylSurZhE6CpkRiE9cpDgGKIkO9CxPlXOLzjqxXuQc8MdMqRQZT",
		"nAwgd7HH0B6gncrruV3NewI-XQV0ckldTjqNfOTz1VRs-jE-57KAXI3YBIhu-_0YpIDzdk_wBuAk",
		"661Svn0GsPQe7m9DoxdzenQu9O_soewUhlPzRrTH0EeIqYI715rwI3TYaSzoWBmEPD2fICyj18FF",
		"0MPy_SQzk3noVUUIzfzLnnJiWy_p63QBCMqjRoSHHdMnI4z9iVpIwJWQ3jO5n_2lC2-cSgwjmKsF",
		"zDBbQNJc7qMG1N6EssJUwgGJxz1eAUFf0w4YAQ",
	].join(""),
	p: [
		"5sd9Er3I2FFT9R-gy84_oakEyCmgw036B_nfYEEOCwpSvi2z7UcIVK3bSEL5WCW6BNgB3HDWhq8a",
		"YPirwQnqm0K9mX1E-4xM10WWZ-rP3XjYpQeS0Snru5LFVWsAzi-FX7BOqBibSAXLdEGXcXa44l08",
		"iec_bPD3xduq5V_1YoE",
	].join(""),
	q: [
		"4hlMYAGa0dvogdK1jnxQ7J_Lqpqi99e-AeoFvoYpMPhthChTzwFZO9lQmUoBpMqVQTws_s7vWGmt",
		"7ZAB3ywkurf0pV7BD0fweJiUzrWk4KJjxtmP_auuxrjvm3s2FUGn6f0wRY9Z8Hj9A7C72DnYCjuZ",
		"iJQMYCWDsZ8-d-L1a-s",
	].join(""),
	dp: [
		"Zc877jirkkLOtyTs2vxyNe9KnMNAmOidlUc2tE_-0gAL4Lpo1hSwKCtKweZJ-gkqt1hT-dwNx_0X",
		"tg_-NXsadMRMwJnzBMYwYAfjApUkfqABc0yUCJJl3KozRCugf1WXkU9GZAH2_x8PUopdNUEa70IS",
		"owPRh04HANKX4fkjWAE",
	].join(""),
	dq: [
		"Nz2PF3XM6bEc4XsluKZO70ErdYdKgdtIJReUR7Rno_tOZpejwlPGBYVW19zpAeYtCT82jxroB2Xq",
		"hLxGeMxEPQpsz2qTKLSe4BgHY2ml2uxSDGdjcsrbbNoKUKaN1CuyZszhWl1n0AT_bENl4bJgQj_F",
		"h0UEsQj5YBBUJt5gr_k",
	].join(""),
	qi: [
		"J-mG0swR4FTy3atrcQ7dd0hhYn1E9QndN--sDG4EQO0RnFj6wIefCvwIc47hCtVeFnCTPYJNc_Jy",
		"V-mU-9vlzS5GSNuyR5qdpsMZXUMpEvQcwKt23ffPZYGaqfKyEesmf_Wi8fFcE68H9REQjnniKrXm",
		"7w2-IuG_IrVJA9Ox-uU",
	].join(""),
};

/** The public half of {@link RFC9126_PRIVATE_JWK}, as a client registers it in `jwks`. */
export const RFC9126_PUBLIC_JWK = {
	kty: RFC9126_PRIVATE_JWK.kty,
	kid: RFC9126_PRIVATE_JWK.kid,
	n: RFC9126_PRIVATE_JWK.n,
	e: RFC9126_PRIVATE_JWK.e,
};
