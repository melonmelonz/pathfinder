// Unit tests for the ported auth crypto library (Epic E2 - Identity, Roles & Access).
// Covers the pure, framework-agnostic functions in src/lib/server/auth.ts:
// PBKDF2-SHA256 password hashing (100000 iters) and HS256 JWT sign/verify,
// both implemented with Web Crypto and ported from v1 els911-portal.
//
// Backs TDD-plan tests T-2.4.1 (audit) and the auth foundation underpinning
// T-2.1.1 / T-2.1.2 (login) and T-2.2.x (RBAC).

import { describe, it, expect } from 'vitest';
import {
	hashPassword,
	verifyPassword,
	signJWT,
	verifyJWT
} from '../../src/lib/server/auth';

const SECRET = 'test-secret-do-not-use-in-prod';

describe('hashPassword / verifyPassword (PBKDF2-SHA256)', () => {
	it('is deterministic for a given password+salt pair', async () => {
		const salt = 'fixed-salt-1234';
		const a = await hashPassword('hunter2', salt);
		const b = await hashPassword('hunter2', salt);
		expect(a).toBe(b);
		expect(typeof a).toBe('string');
		expect(a.length).toBeGreaterThan(0);
	});

	it('produces different hashes for different salts (same password)', async () => {
		const a = await hashPassword('hunter2', 'salt-A');
		const b = await hashPassword('hunter2', 'salt-B');
		expect(a).not.toBe(b);
	});

	it('verifyPassword returns true for the correct password', async () => {
		const salt = 'some-salt';
		const hash = await hashPassword('correct horse', salt);
		expect(await verifyPassword('correct horse', salt, hash)).toBe(true);
	});

	it('verifyPassword returns false for the wrong password', async () => {
		const salt = 'some-salt';
		const hash = await hashPassword('correct horse', salt);
		expect(await verifyPassword('battery staple', salt, hash)).toBe(false);
	});
});

describe('signJWT / verifyJWT (HS256)', () => {
	it('round-trips a payload', async () => {
		const payload = { sub: 'user-1', role: 'admin', email: 'a@b.com' };
		const token = await signJWT(payload, SECRET);
		expect(token.split('.')).toHaveLength(3);
		const decoded = await verifyJWT(token, SECRET);
		expect(decoded.sub).toBe('user-1');
		expect(decoded.role).toBe('admin');
		expect(decoded.email).toBe('a@b.com');
	});

	it('rejects a token signed with a different secret', async () => {
		const token = await signJWT({ sub: 'x' }, SECRET);
		await expect(verifyJWT(token, 'wrong-secret')).rejects.toThrow();
	});

	it('rejects a tampered payload', async () => {
		const token = await signJWT({ sub: 'user-1', role: 'client' }, SECRET);
		const [header, , sig] = token.split('.');
		// Re-encode a payload that claims admin, keep the original signature.
		const forgedBody = Buffer.from(JSON.stringify({ sub: 'user-1', role: 'admin' }))
			.toString('base64url');
		const tampered = `${header}.${forgedBody}.${sig}`;
		await expect(verifyJWT(tampered, SECRET)).rejects.toThrow();
	});

	it('rejects a malformed token', async () => {
		await expect(verifyJWT('not-a-jwt', SECRET)).rejects.toThrow();
	});

	it('rejects an expired token', async () => {
		const past = Math.floor(Date.now() / 1000) - 60;
		const token = await signJWT({ sub: 'user-1', exp: past }, SECRET);
		await expect(verifyJWT(token, SECRET)).rejects.toThrow(/expired/i);
	});

	it('accepts an unexpired token', async () => {
		const future = Math.floor(Date.now() / 1000) + 3600;
		const token = await signJWT({ sub: 'user-1', exp: future }, SECRET);
		const decoded = await verifyJWT(token, SECRET);
		expect(decoded.sub).toBe('user-1');
	});
});
