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

There is **one commented block at the very bottom of
`src/routes/+layout.svelte`** (right above `<style>`, marked
`LIVE TDD DEMO - Step 4`). Uncomment that **single block** and reload - the
signed-in user gets an initials avatar badge in the top-right corner. It's
self-contained (inline style, no import, no CSS to touch elsewhere), so there's
nothing to jump around for.

*"Test-first, then a one-line uncomment lights it up in the real UI."* The block
inlines the same initials logic you just wrote; to drive it from your tested
`initials()` instead, swap the inline expression for `initials(user.name)` and
add the import.

---

## Cleanup after the demo

```bash
rm tests/unit/initials.test.ts src/lib/utils/initials.ts
# then re-comment the one Step-4 block at the bottom of src/routes/+layout.svelte
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
