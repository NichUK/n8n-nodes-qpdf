const { cpSync, existsSync, mkdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

const root = process.cwd();
const distRoot = join(root, 'dist');
const misplacedAssetDir = join(distRoot, 'Qpdf');

if (existsSync(misplacedAssetDir)) {
	rmSync(misplacedAssetDir, { recursive: true, force: true });
}

const targetDir = join(distRoot, 'nodes', 'Qpdf');
mkdirSync(targetDir, { recursive: true });
cpSync(join(root, 'nodes', 'Qpdf', 'qpdf.svg'), join(targetDir, 'qpdf.svg'));
