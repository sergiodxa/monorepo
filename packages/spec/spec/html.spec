use html

# The html capability is pure parsing — permissionless — so, like url.spec and
# unlike http.spec (whose cases stop at a permission gate), these run and
# actually PASS with no grants, no network and no browser. Each test holds the
# markup it reads as a literal, bound as `page.text`: exactly the shape an
# `http.get` response hands over, which is how a real suite writes these.
#
# What is specified here is the addressing vocabulary of ADR-018 §9, which the
# browser namespace answers identically. A document is addressed one way; the
# namespace only says whether a live browser is needed.

test "html.title and html.meta read what a page says about itself" {
	given {
		let page = {
			text: """
				<html>
					<head>
						<title>Invest your money for more charitable impact</title>
						<meta name="description" content="Give more, and give it sooner">
						<meta property="og:image" content="/build/_assets/og-image-a1b2c3.png">
						<link rel="canonical" href="https://example.com/portfolios">
					</head>
					<body><h1>Portfolios</h1></body>
				</html>
			"""
		}
	}
	then {
		# A title, a meta tag and a link are asserted whole by default. `meta`
		# matches `name` or `property`, so `description` and `og:image` are one
		# lookup — a colon could never appear in a dotted path, which is why
		# this is a tool argument rather than a field of a parsed object.
		expect html.title page.text "Invest your money for more charitable impact"
		expect html.meta page.text "description" "Give more, and give it sooner"

		# `rel` is the third head reader, beside `title` and `meta`: it reads a
		# `<link>` by one token of its `rel`. The name `link` belongs to the
		# link role, so an assertion means the same in either namespace.
		expect html.rel page.text "canonical" "https://example.com/portfolios"

		# `containing` is the substring opt-in, which is what a fingerprinted
		# asset URL needs: the hash changes on every build, the prefix does not.
		expect html.meta page.text "og:image" containing "/build/_assets/og-image-"
	}
}

test "a tag the document does not carry is asserted absent with exists" {
	given {
		let page = { text: """<html><head><title>Portfolios</title></head></html>""" }
	}
	then {
		# Absence is an error by default, so that a typo in a tag name fails
		# loud instead of passing quietly. `exists` is how a spec says the
		# absence is the point, and `not` inverts it.
		expect not html.meta page.text "og:title" exists
	}
}

test "an element is addressed by the role and the name a person perceives" {
	given {
		let page = {
			text: """
				<html><body>
					<h1>Portfolios</h1>
					<label for="tip">Tip</label>
					<input id="tip" name="tip" value="20">
					<button type="submit">Save</button>
					<button type="button" disabled>Cancel</button>
				</body></html>
			"""
		}
	}
	then {
		# With no predicate the lookup asserts the element is there, and hands
		# its text back to whatever binds it — the two are one call.
		expect html.element page.text heading "Portfolios"

		# A control's label is its accessible name, so addressing by label
		# needs no feature of its own — and `value` reads what markup spells.
		expect html.element page.text textbox "Tip" value "20"

		# `enabled` and `disabled` are the two states of one predicate.
		expect html.element page.text button "Save" enabled
		expect html.element page.text button "Cancel" disabled

		# `attribute` reads the raw markup rather than the resolved property.
		expect html.element page.text button "Save" attribute "type" "submit"
	}
}

test "the role shorthands read the same as the roles they stand for" {
	given {
		let page = {
			text: """
				<html><body>
					<h1>Portfolios</h1>
					<h2>Holdings</h2>
					<a href="/profile">Profile</a>
					<form aria-label="Alerts">
						<input type="checkbox" id="weekly" name="weekly" checked>
						<label for="weekly">Weekly summary</label>
						<button type="submit">Save</button>
					</form>
				</body></html>
			"""
		}
	}
	then {
		# A shorthand fixes the role its own name says, so `html.button "Save"`
		# and `html.element button "Save"` are the same assertion written two
		# ways — and the same assertion `browser` answers from a live page.
		expect html.heading page.text "Portfolios"
		expect html.link page.text "Profile"
		expect html.button page.text "Save" enabled

		# The whole query vocabulary reaches a shorthand: it is one lookup with
		# the role filled in, not a second grammar.
		expect html.heading page.text containing "Hold" count 1
		expect not html.button page.text "Cancel" exists

		# `level` demands the level a heading claims — through its tag or its
		# `aria-level`, which reach the accessibility tree identically.
		expect html.heading page.text "Holdings" level 2

		# `checked` reads the state the markup carries, which needs no browser.
		expect html.checkbox page.text "Weekly summary" checked
	}
}

test "a name that matches twice is taken by an ordinal, counting from 1" {
	given {
		let page = {
			text: """
				<html><body>
					<nav aria-label="Main"><a href="/profile">Profile</a></nav>
					<footer><a href="/profile">Profile</a></footer>
				</body></html>
			"""
		}
	}
	then {
		# Two matches with no ordinal is an error listing both with their
		# positions: a nav link repeated in the footer would otherwise assert
		# on whichever came first, with no signal that a choice was made.
		expect html.element page.text link "Profile" count 2

		# `first`, `nth n` and `last` opt into one. Ordinals count from 1,
		# deliberately distinct from a 0-based array index.
		expect html.element page.text link "Profile" first
		expect html.element page.text link "Profile" nth 2
		expect html.element page.text link "Profile" last
	}
}

test "a field is addressed by its name attribute, and a value narrows the group" {
	given {
		let page = {
			text: """
				<html><body><form aria-label="Donate">
					<input type="radio" name="cadence" value="monthly">
					<input type="radio" name="cadence" value="annual">
					<textarea name="note">Thanks</textarea>
					<button name="intent" value="save">Save</button>
				</form></body></html>
			"""
		}
	}
	when {
		# `field` sits where a role word sits and resolves anything carrying a
		# `name` attribute — input, textarea, select, button — which removes
		# the single largest reason to reach for a CSS selector. A textarea is
		# reached as a field by name, and as an element by the `textbox` role.
		let note = html.element page.text field "note"
	}
	then {
		expect note "Thanks"

		# A radio group and a submit-intent button share one name, so `value`
		# is what picks one out of the group.
		expect html.element page.text field "cadence" value "annual"
		expect html.element page.text field "intent" value "save"
		expect html.element page.text field "cadence" count 2
	}
}

test "a table and a definition list are read by position and by term" {
	given {
		let page = {
			text: """
				<html><body>
					<table>
						<thead><tr><th>Ticker</th><th>Share</th></tr></thead>
						<tbody>
							<tr><td>VTI</td><td>60%</td></tr>
							<tr><td>BND</td><td>40%</td></tr>
						</tbody>
					</table>
					<dl><dt>Total</dt><dd>$12,400</dd></dl>
				</body></html>
			"""
		}
	}
	when {
		# Rows and columns count from 1 over body rows — the counting a person
		# does reading the table — and `including header` counts the header.
		let ticker = html.cell page.text row 1 column 1
		let share = html.cell page.text row 2 column 2
		let header_cell = html.cell page.text row 1 column 2 including header

		# A definition is read through the term it is paired with, which is a
		# genuine role pairing rather than a translated xpath.
		let total = html.definition page.text "Total"
	}
	then {
		expect ticker "VTI"
		expect share "40%"
		expect header_cell "Share"
		expect total "$12,400"

		# The same comparison is written as one call: a lookup with no
		# predicate reads the element's text, so an expected value closes it
		# the way it closes `html.title` and `html.meta`. Binding first stays
		# worthwhile where the value is asserted more than once.
		expect html.cell page.text row 2 column 2 "40%"
		expect html.definition page.text "Total" "$12,400"

		# It compares whole, like a name and unlike `html.text`, so the two
		# spellings above agree. `containing` is the substring opt-in.
		expect html.cell page.text row 1 column 2 including header containing "Sha"
	}
}

test "the visible text is a substring assertion, unlike a name" {
	given {
		let page = {
			text: """
				<html><body><p>Give more, <strong>and</strong> give it sooner.</p></body></html>
			"""
		}
	}
	then {
		# `text` asks whether a string appears; a role lookup asks whether an
		# element is named X. The two are different questions, so they carry
		# opposite defaults and opposite opt-ins.
		expect html.text page.text "give it sooner"

		# An inline element stays inside its sentence, so the paragraph reads
		# as a reader reads it rather than as the markup nests it.
		expect html.text page.text "Give more, and give it sooner."
	}
}
