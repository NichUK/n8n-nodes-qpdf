import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { spawn } from 'node:child_process';

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { resolveRawArgumentTokens, sanitizeFileName } from './qpdfHelpers';

type QpdfOperation = 'extractPages' | 'merge' | 'rotatePages' | 'rawArguments';

async function runQpdf(commandArgs: string[]): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn('qpdf', commandArgs, {
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		let stderr = '';
		let stdout = '';

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on('error', (error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') {
				reject(
					new Error(
						'qpdf is not installed or not on PATH. Install qpdf in the n8n runtime before using this node.',
					),
				);
				return;
			}

			reject(error);
		});

		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error((stderr || stdout || `qpdf exited with code ${code}`).trim()));
		});
	});
}

const properties: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'extractPages',
		options: [
			{
				name: 'Extract Pages',
				value: 'extractPages',
				description: 'Extract a page range into a new PDF',
				action: 'Extract pages from a PDF',
			},
			{
				name: 'Merge PDFs',
				value: 'merge',
				description: 'Merge multiple PDF binary fields from the same item',
				action: 'Merge PDFs',
			},
			{
				name: 'Rotate Pages',
				value: 'rotatePages',
				description: 'Rotate selected pages in a PDF',
				action: 'Rotate PDF pages',
			},
			{
				name: 'Raw qpdf Arguments',
				value: 'rawArguments',
				description: 'Run qpdf with custom arguments using placeholders',
				action: 'Run qpdf with raw arguments',
			},
		],
	},
	{
		displayName: 'Input Binary Field',
		name: 'inputBinaryField',
		type: 'string',
		default: 'data',
		description: 'Name of the binary field containing the input PDF',
		displayOptions: {
			show: {
				operation: ['extractPages', 'rotatePages'],
			},
		},
	},
	{
		displayName: 'Input Binary Fields',
		name: 'inputBinaryFields',
		type: 'string',
		default: 'data',
		description: 'Comma-separated binary field names containing PDFs to merge',
		displayOptions: {
			show: {
				operation: ['merge', 'rawArguments'],
			},
		},
	},
	{
		displayName: 'Pages',
		name: 'pages',
		type: 'string',
		default: '1',
		description: 'Page selection in qpdf format, for example 1-3,5,7-z',
		displayOptions: {
			show: {
				operation: ['extractPages', 'rotatePages'],
			},
		},
	},
	{
		displayName: 'Rotation',
		name: 'rotation',
		type: 'options',
		default: '+90',
		options: [
			{ name: 'Clockwise 90°', value: '+90' },
			{ name: 'Clockwise 180°', value: '+180' },
			{ name: 'Clockwise 270°', value: '+270' },
			{ name: 'Counterclockwise 90°', value: '-90' },
			{ name: 'Counterclockwise 180°', value: '-180' },
			{ name: 'Counterclockwise 270°', value: '-270' },
		],
		displayOptions: {
			show: {
				operation: ['rotatePages'],
			},
		},
	},
	{
		displayName: 'Raw Arguments',
		name: 'rawArguments',
		type: 'string',
		typeOptions: {
			rows: 4,
		},
		default: '{{input1}} --pages {{input1}} 1 -- {{output}}',
		description:
			'Raw qpdf arguments. Use placeholders like {{input1}}, {{data}}, and {{output}}. Do not include the qpdf executable itself.',
		displayOptions: {
			show: {
				operation: ['rawArguments'],
			},
		},
	},
	{
		displayName: 'Output Binary Field',
		name: 'outputBinaryField',
		type: 'string',
		default: 'data',
		description: 'Name of the binary field to write the resulting PDF to',
	},
	{
		displayName: 'Output File Name',
		name: 'outputFileName',
		type: 'string',
		default: '',
		placeholder: 'Leave empty to auto-generate',
		description: 'Optional output file name',
	},
];

export class Qpdf implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'QPDF',
		name: 'qpdf',
		icon: 'file:qpdf.svg',
		group: ['transform'],
		version: 1,
		description: 'Manipulate PDF files with the qpdf CLI',
		defaults: {
			name: 'QPDF',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const operation = this.getNodeParameter('operation', itemIndex) as QpdfOperation;
			const outputBinaryField = this.getNodeParameter('outputBinaryField', itemIndex) as string;
			const outputFileNameParam = this.getNodeParameter('outputFileName', itemIndex) as string;

			const workDir = await mkdtemp(join(tmpdir(), 'n8n-qpdf-'));

			try {
				let outputBuffer: Buffer;
				let sourceName = 'document.pdf';
				let autoSuffix = 'output';

				if (operation === 'merge' || operation === 'rawArguments') {
					const fieldsRaw = this.getNodeParameter('inputBinaryFields', itemIndex) as string;
					const fieldNames = fieldsRaw
						.split(',')
						.map((field) => field.trim())
						.filter(Boolean);

					if (operation === 'merge' && fieldNames.length < 2) {
						throw new NodeOperationError(
							this.getNode(),
							'Merge PDFs requires at least two input binary fields.',
							{ itemIndex },
						);
					}

					if (operation === 'rawArguments' && fieldNames.length < 1) {
						throw new NodeOperationError(
							this.getNode(),
							'Raw qpdf Arguments requires at least one input binary field.',
							{ itemIndex },
						);
					}

					const inputPaths: string[] = [];
					const placeholderMap = new Map<string, string>();
					for (let index = 0; index < fieldNames.length; index++) {
						const fieldName = fieldNames[index];
						const binaryData = await this.helpers.assertBinaryData(itemIndex, fieldName);
						const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, fieldName);
						const extension = extname(binaryData.fileName ?? '') || '.pdf';
						const inputPath = join(workDir, `input-${index + 1}${extension}`);
						await writeFile(inputPath, buffer);
						inputPaths.push(inputPath);
						const safeFileName = sanitizeFileName(binaryData.fileName, sourceName);
						sourceName = index === 0 ? safeFileName : sourceName;
						placeholderMap.set(`input${index + 1}`, inputPath);
						placeholderMap.set(fieldName, inputPath);
					}

					const outputPath = join(workDir, 'output.pdf');
					placeholderMap.set('output', outputPath);

					if (operation === 'merge') {
						autoSuffix = 'merged';
						await runQpdf(['--empty', '--pages', ...inputPaths, '--', outputPath]);
					} else {
						autoSuffix = 'custom';
						const rawArguments = this.getNodeParameter('rawArguments', itemIndex) as string;
						const resolvedArgs = resolveRawArgumentTokens(rawArguments, placeholderMap);
						await runQpdf(resolvedArgs);
					}

					outputBuffer = await readFile(outputPath);
				} else {
					const inputBinaryField = this.getNodeParameter('inputBinaryField', itemIndex) as string;
					const binaryData = await this.helpers.assertBinaryData(itemIndex, inputBinaryField);
					const inputBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, inputBinaryField);
					sourceName = sanitizeFileName(binaryData.fileName, 'document.pdf');

					const inputPath = join(workDir, 'input.pdf');
					const outputPath = join(workDir, 'output.pdf');
					await writeFile(inputPath, inputBuffer);

					if (operation === 'extractPages') {
						autoSuffix = 'extracted';
						const pages = this.getNodeParameter('pages', itemIndex) as string;
						await runQpdf([inputPath, '--pages', inputPath, pages, '--', outputPath]);
					} else {
						autoSuffix = 'rotated';
						const pages = this.getNodeParameter('pages', itemIndex) as string;
						const rotation = this.getNodeParameter('rotation', itemIndex) as string;
						await runQpdf([inputPath, '--rotate', `${rotation}:${pages}`, '--', outputPath]);
					}

					outputBuffer = await readFile(outputPath);
				}

				const baseName = sourceName.replace(/\.pdf$/i, '');
				const autoFileName = `${baseName}-${autoSuffix}.pdf`;

				const outputFileName = sanitizeFileName(outputFileNameParam, autoFileName);
				const preparedBinary = await this.helpers.prepareBinaryData(
					outputBuffer,
					outputFileName,
					'application/pdf',
				);

				returnData.push({
					json: { operation } as IDataObject,
					binary: {
						[outputBinaryField]: preparedBinary,
					},
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
						pairedItem: { item: itemIndex },
					});
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					error instanceof Error ? error.message : 'Unknown error',
					{ itemIndex },
				);
			} finally {
				await rm(workDir, { recursive: true, force: true });
			}
		}

		return [returnData];
	}
}
