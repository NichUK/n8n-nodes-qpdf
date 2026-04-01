import { basename } from 'node:path';

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
