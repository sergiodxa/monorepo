# form /oidc/logout and get /oidc/check-session — the session-management surface.

# GET /oidc/logout with no parameters, from an anonymous browser. There is nobody
# to log out and no RP-initiated request to honor, so the endpoint asks the person
# to confirm instead — the interactive sign-out page.
#
# seeded happy path: with an `id_token_hint` or a live session, GET performs the
# logout (back-channel notifications, session deletion) and redirects onward.
test "GET /oidc/logout shows the confirmation page for an anonymous visitor" {
	when {
		browser.open "http://localhost:3002/oidc/logout"
	}
	then {
		expect browser.heading "Are you sure you want to logout?"
		expect browser.button "Logout"
	}
}

# POST /oidc/logout — the interactive sign-out button. With no session it destroys
# whatever session cookie there is and redirects (303) to `/authorize`; `http`
# follows that chain onto the sign-in page, so the observable is a final 200. The
# path is on the cop bypass list and reads no form body, so a bodyless POST is
# accepted.
test "POST /oidc/logout signs out and returns to the sign-in flow" {
	when {
		let result = http.post "http://localhost:3002/oidc/logout"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /oidc/check-session — the static Session Management iframe document. It is
# served to be embedded cross-origin by relying parties, so it carries no session
# and needs no seeded state; only its availability is asserted (its content type
# and cache headers are hyphenated names the language cannot reference).
test "GET /oidc/check-session serves the session-checking iframe" {
	when {
		let result = http.get "http://localhost:3002/oidc/check-session"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}
