import test from 'node:test';
import assert from 'node:assert/strict';

import {
	normalizePageSpec,
	parseMetadataInput,
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

test('resolveRawArgumentTokens keeps quoted arguments intact after substitution', () => {
	const placeholders = new Map<string, string>([
		['data', '/tmp/input file.pdf'],
		['output', '/tmp/output file.pdf'],
	]);

	const result = resolveRawArgumentTokens(`"--label=test run" "{{data}}" "{{output}}"`, placeholders);

	assert.deepEqual(result, ['--label=test run', '/tmp/input file.pdf', '/tmp/output file.pdf']);
});

test('sanitizeFileName strips invalid path characters', () => {
	assert.equal(sanitizeFileName('folder\\my:file?.pdf', 'fallback.pdf'), 'my_file_.pdf');
});

test('normalizePageSpec removes spaces around range separators', () => {
	assert.equal(normalizePageSpec('1 - 2'), '1-2');
	assert.equal(normalizePageSpec('1, 3 - 5, 7 - z'), '1,3-5,7-z');
});

test('parseMetadataInput accepts pdf metadata only', () => {
	const result = parseMetadataInput(
		JSON.stringify({
			pdf_metadata: {
				Title: 'Example',
				Creator: 'n8n',
			},
		}),
	);

	assert.deepEqual(result, {
		pdf_metadata: {
			Title: 'Example',
			Creator: 'n8n',
		},
	});
});

test('parseMetadataInput accepts xmp metadata only', () => {
	const result = parseMetadataInput(
		JSON.stringify({
			xmp_metadata: '<?xpacket begin="abc"?>',
		}),
	);

	assert.deepEqual(result, {
		xmp_metadata: '<?xpacket begin="abc"?>',
	});
});

test('parseMetadataInput accepts combined metadata payload', () => {
	const result = parseMetadataInput(
		JSON.stringify({
			pdf_metadata: {
				Title: 'Combined',
				Subject: 'Combined subject',
			},
			xmp_metadata: '<x:xmpmeta></x:xmpmeta>',
		}),
	);

	assert.deepEqual(result, {
		pdf_metadata: {
			Title: 'Combined',
			Subject: 'Combined subject',
		},
		xmp_metadata: '<x:xmpmeta></x:xmpmeta>',
	});
});

test('parseMetadataInput rejects invalid JSON', () => {
	assert.throws(() => parseMetadataInput('{not json}'), /not valid json/i);
});

test('parseMetadataInput rejects non-object payloads', () => {
	assert.throws(() => parseMetadataInput('"hello"'), /must be an object/i);
});

test('parseMetadataInput rejects invalid pdf_metadata type', () => {
	assert.throws(
		() => parseMetadataInput(JSON.stringify({ pdf_metadata: 'bad' })),
		/pdf_metadata must be an object/i,
	);
});

test('parseMetadataInput rejects invalid xmp_metadata type', () => {
	assert.throws(
		() => parseMetadataInput(JSON.stringify({ xmp_metadata: 42 })),
		/xmp_metadata must be a string/i,
	);
});

test('parseMetadataInput requires at least one metadata section', () => {
	assert.throws(
		() => parseMetadataInput(JSON.stringify({})),
		/must include pdf_metadata, xmp_metadata, or both/i,
	);
});
