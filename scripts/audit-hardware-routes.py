"""Read literal route declarations only. Never imports or executes the source project."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=Path)
parser.add_argument('--output', default='docs/HARDWARE_ROUTE_INVENTORY.json', type=Path)
args = parser.parse_args()
source = args.source.resolve()
server_path = source / 'server.ts'
server = server_path.read_text()
mounts = re.findall(r'app\.use\(\s*["\']([^"\']+)["\']\s*,\s*(createHardware\w+Router)\(', server)
imports = dict(re.findall(r'import\s*\{\s*(createHardware\w+Router)\s*\}\s*from\s*["\'](\./routes/hardware/[^"\']+)["\']', server))
files = {'server.ts': hashlib.sha256(server.encode()).hexdigest()}
entries = []
pattern = re.compile(r'\b(app|router)\.(get|post|put|patch|delete|head|options)\(\s*["\']([^"\']+)["\']')

def scan(text, relative, prefix, receiver):
    files[relative] = hashlib.sha256(text.encode()).hexdigest()
    for match in pattern.finditer(text):
        if match[1] != receiver:
            continue
        path = match[3]
        if receiver == 'app' and not (path.startswith('/api/hardware/') or path.startswith('/api/auth/') or path in ['/api/startup-context', '/api/admin/create-staff', '/api/admin/update-staff']):
            continue
        entries.append({'method': match[2].upper(), 'path': prefix + ('' if path == '/' else path), 'source': relative, 'line': text.count('\n', 0, match.start()) + 1, 'review': 'literal registration only; payload and authorization require endpoint-specific review'})

scan(server, 'server.ts', '', 'app')
for prefix, constructor in mounts:
    if constructor not in imports:
        raise SystemExit(f'No literal import found for {constructor}')
    relative = imports[constructor].removeprefix('./') + '.ts'
    scan((source / relative).read_text(), relative, prefix, 'router')
for relative in ['src/contexts/AppContext.tsx', 'src/lib/appSessionLifecycle.ts', 'src/contexts/QueryIdentityBoundary.tsx', 'src/components/auth/AuthScreen.tsx', 'src/components/shared/StaffSwitcherModal.tsx', 'src/components/layout/AdminLayout.tsx', 'src/services/hardwareService.ts', 'src/services/coreService.ts', 'src/types/index.ts', 'routes/hardware/purchaseReadGate.ts', 'src/lib/hardwarePermissions.ts', 'src/lib/hardwareProductsRuntime.ts']:
    files[relative] = hashlib.sha256((source / relative).read_bytes()).hexdigest()
result = {
    'sourceCommit': subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip(),
    'scope': 'Static literal declarations in Hardware routers, shared auth/startup and staff administration. Not a live or exhaustive dynamic route/security audit.',
    'filesSha256': files,
    'routes': sorted(entries, key=lambda row: (row['path'], row['method'], row['source'], row['line'])),
}
args.output.write_text(json.dumps(result, indent=2) + '\n')
print(f'Wrote {len(entries)} literal route declarations from {len(files)} source files to {args.output}')
