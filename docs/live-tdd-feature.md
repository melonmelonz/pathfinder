# Live TDD Runbook - tiny red -> green in front of an audience

A deliberately SMALL feature you build live in ~3-5 minutes to demonstrate
test-driven development: you type a little test, it goes RED, you show the
audience, then you type a little code and it goes GREEN. One pure function, no
UI plumbing, no flakiness.

**The feature:** `initials(name)` - turn a full name into up-to-two uppercase
initials (e.g. for a user avatar badge). `"Test Admin" -> "TA"`. Pure, obvious,
and the kind of helper a real app actually needs.

> Keep these two files OUT of git until the demo so the repo stays green. You
> create them live (or pre-create the empty stubs and only type the two
> highlighted fill-ins on stage).

---

## Before you start (10 seconds, off-screen)

Open a terminal and start the watcher so the audience sees tests re-run live:

```bash
cd ~/dev/pathfinder
npx vitest --watch initials
```

It will say "no test files found" - that's expected; we create one next.

---

## Step 1 - RED: write the test, watch it fail (you type this live)

Create `tests/unit/initials.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { initials } from '../../src/lib/utils/initials';

describe('initials', () => {
	it('takes up to two uppercase initials from a name', () => {
		// >>> THE LIVE FILL-IN (type this line on stage) <<<
		expect(initials('Test Admin')).toBe('TA');
	});
});
```

Save. The watcher goes **RED** - `initials` does not exist yet
("Failed to resolve import"). *"That's TDD: the test describes the behaviour
before the code exists. Red means we have a real, failing spec to satisfy."*

---

## Step 2 - GREEN: write the code, watch it pass (you type this live)

Create `src/lib/utils/initials.ts`:

```ts
/** Up to two uppercase initials from a full name ("Test Admin" -> "TA"). */
export function initials(name: string): string {
	// >>> THE LIVE FILL-IN (type this body on stage) <<<
	return name
		.trim()
		.split(/\s+/)
		.slice(0, 2)
		.map((w) => w[0] ?? '')
		.join('')
		.toUpperCase();
}
```

Save. The watcher flips to **GREEN** - 1 passing. *"Same test, now satisfied by
the smallest code that makes it pass. Red, green - done."*

---

## Step 3 (optional, +1 min) - one more case to show the cycle again

Add a second assertion to the test (RED), then nudge the code (GREEN):

```ts
// RED: a single-word name -> one initial
expect(initials('Pathfinder')).toBe('P');
// (already passes with the code above - point out it handles this for free)

// RED: extra whitespace shouldn't matter
expect(initials('  jane   doe ')).toBe('JD');
// (also already green - the trim()/split(/\s+/) covers it)
```

Nice beat: the audience sees the code is already robust because it was written
to a spec, not to one happy-path example.

---

## Step 4 (optional bonus) - make it visible in the app

If you want a visual payoff, drop an avatar badge in the header using the new
function. In `src/routes/+layout.svelte`, inside the `.who` block:

```svelte
<script>
	import { initials } from '$lib/utils/initials';
</script>

<span class="avatar" aria-hidden="true">{initials(user.name)}</span>
```

```css
.avatar {
	display: grid;
	place-items: center;
	width: 2rem;
	height: 2rem;
	border-radius: var(--radius-pill);
	background: color-mix(in srgb, var(--brand-primary) 22%, transparent);
	color: var(--brand-primary);
	font-family: var(--brand-font-mono);
	font-size: 0.75rem;
	font-weight: 700;
}
```

Reload - the signed-in user now has a "TA" avatar. *"Test-first, then wired into
the real UI in one line."*

---

## Cleanup after the demo

```bash
rm tests/unit/initials.test.ts src/lib/utils/initials.ts
# (and revert the +layout.svelte avatar if you added Step 4)
```

The repo is back to its committed, all-green state.

---

### Why this one
- **Truly small:** one pure function, one assertion to start - fits in a few
  minutes with zero risk of a live flake.
- **Honest TDD:** the failing import is genuine red; the body is the minimal
  green. No theatrics.
- **Real:** initials/avatars are something the app legitimately uses, so it
  doesn't feel like a toy.
