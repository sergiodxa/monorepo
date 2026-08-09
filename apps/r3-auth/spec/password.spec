# form /password/forgot and form /password/reset — the unauthenticated recovery
# flow. Forgot is fully self-contained (no seeded state), so its happy path is
# specifiable end to end through a real browser; reset needs a live token to reach
# its form, so only its no-token outcome is asserted here.

# GET /password/forgot — the empty request form.
test "GET /password/forgot renders the request form" {
	when {
		browser.open "http://localhost:3002/password/forgot"
	}
	then {
		expect browser.heading "Reset your password"
		expect browser.button "Send reset link"
	}
}

# POST /password/forgot — submitting an address always lands on the same
# confirmation, whether or not the address belongs to an account: revealing that
# is the one thing this form must never do. Driven through a real browser because
# the happy path needs a genuine form submission, and an unknown address exercises
# exactly the same observable a known one would.
test "POST /password/forgot confirms without revealing whether the address is registered" {
	when {
		browser.open "http://localhost:3002/password/forgot"
		browser.fill textbox "Email" with "spec-unknown@example.com"
		browser.click button "Send reset link"
	}
	then {
		expect browser.heading "Check your inbox"
	}
}

# GET /password/reset — with no token the link cannot be resolved, so it renders
# the "this link no longer works" page. A token-less request never spends the
# rate-limit budget, so this is safe to run repeatedly.
#
# seeded happy path: a live reset token renders "Choose a new password".
test "GET /password/reset shows the invalid-link page when no token is present" {
	when {
		browser.open "http://localhost:3002/password/reset"
	}
	then {
		expect browser.heading "This link no longer works"
	}
}

# POST /password/reset — a bodyless submission fails the form schema and, finding
# no token to re-offer, renders the invalid-link page at a 400.
#
# seeded happy path: a live token plus two matching passwords sets the new hash,
# revokes every session, and renders "Password changed".
test "POST /password/reset rejects a submission carrying no token" {
	when {
		let result = http.post "http://localhost:3002/password/reset"
	}
	then {
		expect result.status 400
		expect result.ok false
	}
}
