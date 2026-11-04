// Simplifies a Tripo figure on positions only (seams allowed to collapse), keeps its texture.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { prune, dedup, textureCompress, meshopt, weld, compactPrimitive } from '@gltf-transform/functions';
import fs from 'fs';
await MeshoptSimplifier.ready; await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const [src, dst, targetTris] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
await doc.transform(weld());
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();
  // Vertex clustering: snap vertices to a grid of `cells` across the figure's height, keep one
  // vertex per cell (its UV comes along), drop triangles that collapse.
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let v = 0; v < pos.length; v += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], pos[v + a]); mx[a] = Math.max(mx[a], pos[v + a]); }
  const cell = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / Number(process.argv[5] || 140);
  const uv = prim.getAttribute('TEXCOORD_0').getArray();
  const UVQ = Number(process.argv[6] || 24);
  const rep = new Map(), map = new Uint32Array(pos.length / 3);
  for (let v = 0; v < map.length; v++) {
    // UV joins the key (coarsely) so vertices on opposite sides of a texture seam stay apart.
    const k = `${Math.floor((pos[v * 3] - mn[0]) / cell)},${Math.floor((pos[v * 3 + 1] - mn[1]) / cell)},${Math.floor((pos[v * 3 + 2] - mn[2]) / cell)}|${Math.floor(uv[v * 2] * UVQ)},${Math.floor(uv[v * 2 + 1] * UVQ)}`;
    if (!rep.has(k)) rep.set(k, v);
    map[v] = rep.get(k);
  }
  // Close seam cracks: every kept vertex in a grid cell takes that cell's one shared position.
  const cellPos = new Map();
  const P = new Float32Array(pos);
  for (let v = 0; v < map.length; v++) {
    if (map[v] !== v) continue;
    const ck = `${Math.floor((pos[v * 3] - mn[0]) / cell)},${Math.floor((pos[v * 3 + 1] - mn[1]) / cell)},${Math.floor((pos[v * 3 + 2] - mn[2]) / cell)}`;
    if (!cellPos.has(ck)) cellPos.set(ck, v);
    const c = cellPos.get(ck);
    P[v * 3] = pos[c * 3]; P[v * 3 + 1] = pos[c * 3 + 1]; P[v * 3 + 2] = pos[c * 3 + 2];
  }
  prim.getAttribute('POSITION').setArray(P);
  const outIdx = [];
  const seenTri = new Set();
  for (let i = 0; i < idx.length; i += 3) {
    const a = map[idx[i]], b = map[idx[i + 1]], c = map[idx[i + 2]];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (seenTri.has(key)) continue;
    seenTri.add(key);
    outIdx.push(a, b, c);
  }
  const res = new Uint32Array(outIdx);
  prim.getIndices().setArray(res);
  compactPrimitive(prim);
  console.log('tris', idx.length / 3, '->', res.length / 3);
}
await doc.transform(prune(), dedup(), textureCompress({ targetFormat: 'webp', resize: [1024, 1024] }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
await io.write(dst, doc);
console.log(dst, (fs.statSync(dst).size / 1e6).toFixed(2), 'MB');
