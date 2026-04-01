import test from 'node:test';
import assert from 'node:assert/strict';

import {
	normalizePageSpec,
	resolveRawArgumentTokens,
	sanitizeFileName,
	tokenizeArguments,
} from '../nodes/Qpdf/qpdfHelpers';

test('tokenizeArguments respects quoted values', () => {
	const result = tokenizeArguments(`--password="a b c" "input file.pdf" -- output.pdf`);
	assert.deepEqual(result, ['--password=a b c', 'input file.pdf', '--', 'output.pdf']);
});

test('tokenizeArguments rejects unmatched quotes', () => {
	assert.throws(() => tokenizeArguments(`"unterminated`), /unmatched quote/i);
});

test('resolveRawArgumentTokens substitutes known placeholders', () => {
	const placeholders = new Map<string, string>([
		['input1', '/tmp/input.pdf'],
		['data', '/tmp/input.pdf'],
		['output', '/tmp/output.pdf'],
	]);

	const result = resolveRawArgumentTokens(
		'{{input1}} --pages {{data}} 3-5 -- {{output}}',
		placeholders,
	);

	assert.deepEqual(result, [
		'/tmp/input.pdf',
		'--pages',
		'/tmp/input.pdf',
		'3-5',
		'--',
		'/tmp/output.pdf',
	]);
});

test('resolveRawArgumentTokens rejects unknown placeholders', () => {
	const placeholders = new Map<string, string>([['output', '/tmp/output.pdf']]);
	assert.throws(
		() => resolveRawArgumentTokens('{{input1}} -- {{output}}', placeholders),
		/Unknown raw argument placeholder: input1/,
	);
});

test('sanitizeFileName strips invalid path characters', () => {
	assert.equal(sanitizeFileName('folder\\my:file?.pdf', 'fallback.pdf'), 'my_file_.pdf');
});

test('normalizePageSpec removes spaces around range separators', () => {
	assert.equal(normalizePageSpec('1 - 2'), '1-2');
	assert.equal(normalizePageSpec('1, 3 - 5, 7 - z'), '1,3-5,7-z');
});
