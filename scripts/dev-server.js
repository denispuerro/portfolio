import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!fs.existsSync(path.join(root, 'package.json'))) {
  console.error('\n❌ Projet inaccessible.');
  console.error('   → Vérifie que le volume Commun est monté dans le Finder.');
  console.error('   → Ferme CE terminal, ouvre-en un nouveau, puis :');
  console.error('     cd /Volumes/Commun/Denis/Porfolio');
  console.error('     npm run dev\n');
  process.exit(1);
}

const viteBin = path.join(root, 'node_modules', '.bin', 'vite');
const child = spawn(viteBin, ['--host', '127.0.0.1'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => process.exit(code ?? 1));

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
