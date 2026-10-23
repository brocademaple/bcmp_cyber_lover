import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const output = path.resolve('output/luya-preview');
const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', output], {
  stdio: 'inherit', env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_DEEPSEEK_API_KEY: '' },
});
if (result.status) process.exit(result.status);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env?import.meta.env.MODE:void 0', 'undefined');
      if (/\bsk-[A-Za-z0-9_-]{20,}\b/.test(source)) throw new Error('Secret detected in preview bundle');
      fs.writeFileSync(file, source);
    }
  }
}
walk(output);
