import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');

export const VERSION: string = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')).version;
