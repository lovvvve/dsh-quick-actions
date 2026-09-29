"""Check that local tarballs carry the verified footer build, without installing."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile

core, plugin, artifacts = map(Path, sys.argv[1:])
results = []
for root, stem, expected_name in [
    (core / "packages/client/ui-conversation", "deepseek-ai-dsh-client-ui-conversation", "@deepseek-ai/dsh-client-ui-conversation"),
    (plugin / "packages/composer-quick-actions", "dsh-quick-actions", "dsh-quick-actions"),
]:
    source_manifest = json.loads((root / "package.json").read_text())
    archive = artifacts / f"{stem}-{source_manifest['version']}.tgz"
    with tarfile.open(archive, "r:gz") as package:
        def content(name):
            stream = package.extractfile(f"package/{name}")
            if stream is None:
                raise RuntimeError(f"missing {name}")
            return stream.read()

        manifest = json.loads(content("package.json"))
        assert manifest["name"] == expected_name
        assert manifest["version"] == source_manifest["version"]
        assert content("lib/client.js") == (root / "lib/client.js").read_bytes()
        assert content("lib/index.js") == (root / "lib/index.js").read_bytes()
        assert b"conversation.composer.footer" in content("lib/client.js")
        if stem.startswith("deepseek-ai"):
            assert b"conversation.composer.footer" in content("lib/types/client/contract/slots.d.ts")
        results.append({
            "file": archive.name,
            "name": manifest["name"],
            "version": manifest["version"],
            "bytes": archive.stat().st_size,
            "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
            "clientSha256": hashlib.sha256(content("lib/client.js")).hexdigest(),
        })
print(json.dumps({"status": "passed", "artifacts": results}, indent=2))
