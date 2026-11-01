"""Restore an already signed public APK from the original CI APK and public ZIP/signature data.

This does not sign new content and contains no private key. Both complete files are pinned by SHA-256.
"""
import base64
import gzip
import hashlib
import json
import pathlib
import sys

source, recipe_path, destination = map(pathlib.Path, sys.argv[1:])
recipe = json.loads(gzip.decompress(base64.b64decode(recipe_path.read_text().strip(), validate=True)))
data = source.read_bytes()
assert recipe['format'] == 1
assert hashlib.sha256(data).hexdigest() == recipe['source_sha256'], 'CI APK hash mismatch'
destination.parent.mkdir(parents=True, exist_ok=True)
digest = hashlib.sha256()
size = 0
with destination.open('wb') as output:
    for operation in recipe['operations']:
        if 'copy' in operation:
            start, length = operation['copy']
            assert start >= 0 and length >= 0 and start + length <= len(data)
            block = data[start:start + length]
        else:
            block = base64.b64decode(operation['literal'], validate=True)
        output.write(block)
        digest.update(block)
        size += len(block)
assert size == recipe['target_size'] and digest.hexdigest() == recipe['target_sha256'], 'Tested APK hash mismatch'
print('Restored the exact tested and signed APK:', digest.hexdigest())
