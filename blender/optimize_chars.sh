#!/bin/sh
# Post-process the Blender character exports: decimate to ~3k tris/character (keeps node names, materials, no compression).
# usage: blender/optimize_chars.sh <dir with char_*.glb> <outdir>
mkdir -p "$2"; for f in "$1"/char_*.glb; do npx gltfpack -i "$f" -o "$2/$(basename "$f")" -si 0.4 -se 0.02 -kn -km; done
