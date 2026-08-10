use jwt

# jwt.decode is permissionless: it base64url-decodes a token's header and
# payload and never checks the signature or reaches the network, so this case
# runs and actually PASSES with no grants. The token is a literal — header
# {alg:ES256,kid:spec-key}, payload {sub,aud,iss} — with an arbitrary signature
# segment, since decode ignores it. Signature verification (jwt.verify) needs a
# JWKS server and the net grant; its denial path is covered by jwt.spec.

test "jwt.decode splits a literal token into its header and payload claims" {
	when {
		let decoded = jwt.decode "eyJhbGciOiJFUzI1NiIsImtpZCI6InNwZWMta2V5In0.eyJzdWIiOiJzcGVjLXVzZXIiLCJhdWQiOiJzcGVjLWNsaWVudCIsImlzcyI6ImF1dGguc2VyZ2lvZHhhLmNvbSJ9.c2lnbmF0dXJlLWlnbm9yZWQ"
	}
	then {
		expect decoded.header.alg "ES256"
		expect decoded.header.kid "spec-key"
		expect decoded.payload.sub "spec-user"
		expect decoded.payload.aud "spec-client"
		expect decoded.payload.iss "auth.sergiodxa.com"
	}
}
