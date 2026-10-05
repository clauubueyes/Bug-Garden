import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseInboundMessage } from './messages.ts';

describe('parseInboundMessage', () => {
	it('accepts the supported message types', () => {
		assert.deepEqual(parseInboundMessage({ type: 'garden/ready' }), { type: 'garden/ready' });
		assert.deepEqual(parseInboundMessage({ type: 'garden/refresh' }), { type: 'garden/refresh' });
		assert.deepEqual(parseInboundMessage({ type: 'project/select', projectId: 'p' }), {
			type: 'project/select',
			projectId: 'p',
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