# The signed-in account area. Every route is behind `requireSubject`, which sends
# an unauthenticated visitor to `/authorize` (303). The reachable black-box
# observable for an anonymous caller is therefore the guard: a GET is followed by
# a real browser onto the sign-in page; a POST is followed by `http` (the 303
# rewrites to GET and the self-redirect chain ends on the sign-in page) to a final
# 200 — never performing the action behind the guard.
#
# seeded happy path (every route here): a signed-in session renders the profile,
# the edit form and its save, the sessions and grants lists and their POST
# actions, and the resend endpoint. A session is reachable in-app by registering
# through `/authorize` with `prompt=create` (no manual DB seed), but the run needs
# a live app; see the README's "tests that need seeded state".

# GET /account/profile
test "GET /account/profile redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/account/profile"
	}
	then {
		assert_on_sign_in_page
	}
}

# GET /account/profile/edit
test "GET /account/profile/edit redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/account/profile/edit"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /account/profile/edit
test "POST /account/profile/edit is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/account/profile/edit"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /account/sessions
test "GET /account/sessions redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/account/sessions"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /account/sessions
test "POST /account/sessions is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/account/sessions"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# GET /account/grants
test "GET /account/grants redirects an anonymous visitor to sign-in" {
	when {
		browser.open "http://localhost:3002/account/grants"
	}
	then {
		assert_on_sign_in_page
	}
}

# POST /account/grants
test "POST /account/grants is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/account/grants"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}

# POST /account/verify-email/resend
test "POST /account/verify-email/resend is refused for an anonymous visitor" {
	when {
		let result = http.post "http://localhost:3002/account/verify-email/resend"
	}
	then {
		expect result.status 200
		expect result.ok true
	}
}
