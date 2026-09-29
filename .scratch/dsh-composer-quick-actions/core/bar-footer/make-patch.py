"""Build and apply-check the patch against the supplied exact GitHub archive."""
import difflib
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile

root = Path(sys.argv[1]).resolve()
output = Path(__file__).resolve().parent
base = root / '.footer-patch-check'
base.mkdir(exist_ok=True)
changes = []
patch = []
with tarfile.open(root.parent / 'source.tar.gz', 'r:gz') as archive:
    for member in archive:
        if not member.isfile():
            continue
        parts = Path(member.name).parts
        if len(parts) < 2:
            continue
        path = Path(*parts[1:])
        current = root / path
        before = archive.extractfile(member).read()
        after = current.read_bytes()
        if before == after:
            continue
        old = before.decode('utf-8').splitlines(keepends=True)
        new = after.decode('utf-8').splitlines(keepends=True)
        patch.append(f'diff --git a/{path} b/{path}\n')
        patch.extend(difflib.unified_diff(old, new, fromfile=f'a/{path}', tofile=f'b/{path}'))
        target = base / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(before)
        changes.append({'path': str(path), 'baseSha256': hashlib.sha256(before).hexdigest(), 'patchedSha256': hashlib.sha256(after).hexdigest()})
patch_file = output / 'conversation-composer-footer.patch'
patch_file.write_text(''.join(patch))
subprocess.run(['git', 'apply', '--check', '--whitespace=error', str(patch_file)], cwd=base, check=True)
subprocess.run(['git', 'apply', str(patch_file)], cwd=base, check=True)
for change in changes:
    assert (base / change['path']).read_bytes() == (root / change['path']).read_bytes()
subprocess.run(['git', 'apply', '--reverse', '--check', str(patch_file)], cwd=base, check=True)
metadata = {'baseCommit': '477b4f420553e8a52c2fbccc464d7561b239c443', 'archiveSha256': hashlib.sha256((root.parent / 'source.tar.gz').read_bytes()).hexdigest(), 'patchSha256': hashlib.sha256(patch_file.read_bytes()).hexdigest(), 'files': changes}
(output / 'patch-manifest.json').write_text(json.dumps(metadata, indent=2) + '\n')
print(json.dumps(metadata, indent=2))
print('git apply --check --whitespace=error: PASS; apply byte comparison: PASS; reverse --check: PASS')
