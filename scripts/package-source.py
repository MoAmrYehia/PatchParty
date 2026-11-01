"""Build a portable source download without runtime data or hosting identity."""
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
folders = {'app', 'lib', 'db', 'drizzle', 'worker', 'scripts', 'public', 'vendor', 'docs'}
files = {'package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'tsconfig.json', 'cloudflare-env.d.ts', 'drizzle.config.ts', 'next.config.ts', 'next.config.mjs', 'postcss.config.mjs', 'eslint.config.mjs', 'README.md', '.gitignore', 'LICENSE', 'NOTICE.md'}
output = root / 'public' / 'patch-party-source.zip'
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    candidates = [root / name for name in files if (root / name).is_file()]
    for name in folders:
        candidates.extend((root / name).rglob('*'))
    for path in sorted(candidates):
        relative = path.relative_to(root)
        if not path.is_file() or path == output:
            continue
        if relative.parts[0] not in folders and str(relative) not in files:
            continue
        if any(p in {'node_modules', '__pycache__', '.sites-runtime', '.wrangler', '.git'} for p in relative.parts):
            continue
        if path.name.startswith(('.env', '.dev.vars', 'qa-')) or path.suffix in {'.pem', '.pyc'}:
            continue
        archive.write(path, Path('patch-party') / relative)
    manifest = {'d1': 'DB', 'r2': None}
    archive.writestr('patch-party/.openai/hosting.json', json.dumps(manifest, indent=2) + '\n')
print(f'Source download: {output} ({output.stat().st_size:,} bytes)')
