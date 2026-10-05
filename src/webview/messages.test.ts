import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseInboundMessage } from './messages.ts';

describe('parseInboundMessage', () => {
	it('accepts the supported message types', () => {
		assert.deepEqual(parseInboundMessage({ type: 'garden/ready' }), { type: 'garden/ready' });
		assert.deepEqual(parseInboundMessage({ type: 'garden/refresh' }), { type: 'garden/refresh' });
		assert.deepEqual(parseInboundMessage({ type: 'garden/expand' }), { type: 'garden/expand' });
		assert.deepEqual(parseInboundMessage({ type: 'garden/openFolder' }), { type: 'garden/openFolder' });
		assert.deepEqual(parseInboundMessage({ type: 'project/select', projectId: 'p' }), {
			type: 'project/select',
			projectId: 'p',
		});
	});

	it('accepts validated layout changes and commit-copy requests', () => {
		assert.deepEqual(parseInboundMessage({ type: 'garden/preferences', projectId: 'p',
			preferences: { atmosphere: 'night', slots: ['a', null, 'a'] } }), {
			type: 'garden/preferences', projectId: 'p', preferences: { atmosphere: 'night', slots: ['a', null, null] },
		});
		assert.deepEqual(parseInboundMessage({ type: 'plant/copyCommit', projectId: 'p', instanceId: 'a' }), {
			type: 'plant/copyCommit', projectId: 'p', instanceId: 'a',
		});
	});

	it('rejects unknown or malformed messages', () => {
		const invalid: unknown[] = [
			undefined,
			null,
			'project/select',
			42,
			{},
			{ type: 'unknown' },
			{ type: 7 },
			{ type: 'project/select' },
			{ type: 'project/select', projectId: '' },
			{ type: 'project/select', projectId: null },
			{ type: 'garden/preferences', projectId: 'p', preferences: { atmosphere: 'rain', slots: [] } },
			{ type: 'garden/preferences', projectId: '', preferences: { atmosphere: 'day', slots: [] } },
			{ type: 'garden/preferences', projectId: 'p', preferences: { atmosphere: 'day', slots: [42] } },
			{ type: 'plant/copyCommit', projectId: 'p' },
			{ type: 'plant/copyCommit', projectId: 'p', instanceId: '' },
			{ type: 'plant/copyCommit', projectId: null, instanceId: 'a' },
		];
		for (const value of invalid) {
			assert.equal(parseInboundMessage(value), null, JSON.stringify(value));
		}
	});

	it('ignores extra properties', () => {
		assert.deepEqual(parseInboundMessage({ type: 'garden/ready', evil: 'payload' }), {
			type: 'garden/ready',
		});
	});
});
