import { basename } from 'node:path';

export interface QpdfMetadataInput {
	pdf_metadata?: Record<string, string | number | boolean | null>;
	xmp_metadata?: string;
}

export function sanitizeFileName(fileName: string | undefined, fallback: string): string {
	const raw = fileName && fileName.trim() ? fileName : fallback;
	return basename(raw).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
}

export function tokenizeArguments(argumentString: string): string[] {
	const tokens: string[] = [];
	let current = '';
	let quote: '"' | "'" | null = null;
	let escaping = false;

	for (const character of argumentString) {
		if (escaping) {
			current += character;
			escaping = false;
			continue;
		}

		if (character === '\\') {
			escaping = true;
			continue;
		}

		if (quote) {
			if (character === quote) {
				quote = null;
			} else {
				current += character;
			}
			continue;
		}

		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}

		if (/\s/.test(character)) {
			if (current) {
				tokens.push(current);
				current = '';
			}
			continue;
		}

		current += character;
	}

	if (quote) {
		throw new Error('Raw arguments contain an unmatched quote.');
	}

	if (escaping) {
		current += '\\';
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

export function resolveRawArgumentTokens(
	rawArguments: string,
	placeholderMap: Map<string, string>,
): string[] {
	return tokenizeArguments(rawArguments).map((token) =>
		token.replace(/\{\{([^}]+)\}\}/g, (_match, placeholder: string) => {
			const key = placeholder.trim();
			const value = placeholderMap.get(key);

			if (!value) {
				throw new Error(`Unknown raw argument placeholder: ${key}`);
			}

			return value;
		}),
	);
}

export function normalizePageSpec(pageSpec: string): string {
	return pageSpec
		.trim()
		.replace(/\s*-\s*/g, '-')
		.replace(/\s*,\s*/g, ',')
		.replace(/\s+/g, ' ');
}

export function parseMetadataInput(metadataJson: string): QpdfMetadataInput {
	let parsed: unknown;

	try {
		parsed = JSON.parse(metadataJson);
	} catch (error) {
		throw new Error(
			`Metadata JSON is not valid JSON: ${error instanceof Error ? error.message : 'unknown error'}`,
		);
	}

	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('Metadata JSON must be an object.');
	}

	const metadata = parsed as QpdfMetadataInput;

	if (
		metadata.pdf_metadata !== undefined &&
		(!metadata.pdf_metadata ||
			typeof metadata.pdf_metadata !== 'object' ||
			Array.isArray(metadata.pdf_metadata))
	) {
		throw new Error('metadata.pdf_metadata must be an object when provided.');
	}

	if (
		metadata.xmp_metadata !== undefined &&
		typeof metadata.xmp_metadata !== 'string'
	) {
		throw new Error('metadata.xmp_metadata must be a string when provided.');
	}

	if (metadata.pdf_metadata === undefined && metadata.xmp_metadata === undefined) {
		throw new Error('Metadata JSON must include pdf_metadata, xmp_metadata, or both.');
	}

	return metadata;
}
