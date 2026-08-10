use url

# The url capability is pure parsing — permissionless — so unlike db.spec and
# http.spec (whose cases stop at a permission gate), these run and actually PASS
# with no grants and no network. The URLs are literal strings: exactly the
# redirect URLs an OAuth authorize step hands back, read with url.query the way a
# flow spec would extract the authorization `code` and `state`.

test "url.query reads query-string parameters from a literal redirect URL" {
	when {
		let code = url.query "http://localhost:3002/healthcheck?code=abc123&state=spec-code" "code"
		let state = url.query "http://localhost:3002/healthcheck?code=abc123&state=spec-code" "state"
	}
	then {
		expect code "abc123"
		expect state "spec-code"
	}
}

test "url.fragment reads a parameter after the hash" {
	when {
		let token = url.fragment "http://localhost:3002/cb#access_token=tok-xyz&token_type=bearer" "access_token"
	}
	then {
		expect token "tok-xyz"
	}
}

test "url.path and url.host read the URL structure" {
	when {
		# Bind under names that do not collide with the imported url.path/url.host
		# tools: a bare name that is both a binding and a tool is ambiguous.
		let pathname = url.path "http://localhost:3002/oauth/token?x=1"
		let authority = url.host "http://localhost:3002/oauth/token?x=1"
	}
	then {
		expect pathname "/oauth/token"
		expect authority "localhost:3002"
	}
}
