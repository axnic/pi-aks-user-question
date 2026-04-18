# Release Notes Examples

## Example 1 — Feature + fix + chore

### Input

```text
sha: a1b2c3d
subject: feat(form): Add "Other" text input to choice questions
body: Allows users to type a free-form value when none of the preset options fits.
author: Alice Martin (@alice)
pr: #12 (https://github.com/axnic/pi-aks-user-question/pull/12)

---

sha: d4e5f6a
subject: fix(validation): Email validator no longer rejects subdomains
body:
author: Bob Chen (@bob-chen)
pr: #15 (https://github.com/axnic/pi-aks-user-question/pull/15)

---

sha: f7a8b9c
subject: chore(deps): Bump TypeScript to 5.8
body:
author: Alice Martin (@alice)
pr: #14 (https://github.com/axnic/pi-aks-user-question/pull/14)
```

### Output

## What's new in v1.3.0

This release adds an "Other" free-text fallback to choice questions so users
are never forced to pick an option that doesn't fit their situation. Email
validation is also more permissive, correctly accepting subdomain addresses.

### ▸ Changes

- `✦ **form**: "Other" free-text input available on choice questions` ([#12](https://github.com/axnic/pi-aks-user-question/pull/12) by [@alice](https://github.com/alice))
- `✔ **validation**: Email validator now accepts subdomain addresses` ([#15](https://github.com/axnic/pi-aks-user-question/pull/15) by [@bob-chen](https://github.com/bob-chen))
- `⚙ Bump TypeScript to 5.8` ([#14](https://github.com/axnic/pi-aks-user-question/pull/14) by [@alice](https://github.com/alice))

### ◈ Contributors

Thanks to all the contributors to this release:

- [@alice](https://github.com/alice) ([#12](https://github.com/axnic/pi-aks-user-question/pull/12), [#14](https://github.com/axnic/pi-aks-user-question/pull/14))
- [@bob-chen](https://github.com/bob-chen) ([#15](https://github.com/axnic/pi-aks-user-question/pull/15))

---

<sup>Release notes enhanced by [GitHub Copilot](https://github.com/features/copilot)</sup>

---

## Example 2 — Release candidate

### Input

```text
sha: b2c3d4e
subject: feat(form): Multi-select checkboxes with Space/Enter toggle
body: Lets users pick multiple options from a list without leaving the keyboard.
author: Charlie Dupont (@charlie-d)
pr: #20 (https://github.com/axnic/pi-aks-user-question/pull/20)

---

sha: e5f6a7b
subject: fix(schema): Required questions no longer accept empty text submissions
body:
author: Alice Martin (@alice)
pr: #18 (https://github.com/axnic/pi-aks-user-question/pull/18)
```

### Output

## What's new in v1.3.0-rc.1

First release candidate for v1.3.0. This RC introduces multi-select checkbox
support for choice questions and closes a gap where required text questions
could be submitted empty.

### ▸ Changes

- `✦ **form**: Multi-select checkboxes with Space/Enter toggle` ([#20](https://github.com/axnic/pi-aks-user-question/pull/20) by [@charlie-d](https://github.com/charlie-d))
- `✔ **schema**: Required questions no longer accept empty text submissions` ([#18](https://github.com/axnic/pi-aks-user-question/pull/18) by [@alice](https://github.com/alice))

### ◈ Contributors

Thanks to all the contributors to this release:

- [@charlie-d](https://github.com/charlie-d) ([#20](https://github.com/axnic/pi-aks-user-question/pull/20))
- [@alice](https://github.com/alice) ([#18](https://github.com/axnic/pi-aks-user-question/pull/18))

---

<sup>Release notes enhanced by [GitHub Copilot](https://github.com/features/copilot)</sup>
