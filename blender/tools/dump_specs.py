"""Records the primitive lists of the game's procedural builders (js/models3.js) as JSON specs in ../specs/.
The Blender scripts (blender/build_all.py) rebuild every model from these specs (plus hand-written Python for
props), add bevels / smooth shading / role materials, and export .glb files.

    python3 blender/tools/dump_specs.py http://localhost:8123
"""
import sys, json, os
from playwright.sync_api import sync_playwright
base = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123'
out = os.path.join(os.path.dirname(__file__), '..', 'specs')
JS = r"""
() => {
  const G = window.G, T = THREE;
  const info = (g) => { const p = g.parameters || {}; switch (g.type) {
    case 'BoxGeometry': return { k: 'box' };
    case 'CylinderGeometry': return { k: 'cyl', a: p.radiusTop / p.radiusBottom, seg: p.radialSegments };
    case 'SphereGeometry': return { k: 'sph', seg: p.widthSegments };
    case 'ConeGeometry': return { k: 'cone', seg: p.radialSegments };
    case 'IcosahedronGeometry': return { k: 'ico', a: p.detail || 0 };
    case 'TorusGeometry': return { k: 'torus', a: p.radius, b: p.tube, c: p.arc };
    default: throw new Error('prim ' + g.type); } };
  const ser = (list, glow) => list.map(p => Object.assign(info(p.geo), { col: p.col, x: p.x, y: p.y, z: p.z, sx: p.sx, sy: p.sy, sz: p.sz, rx: p.rx, ry: p.ry, rz: p.rz, glow: glow }));
  const all = (b) => ser(b.lit, false).concat(ser(b.glow, true));
  const rec = []; const bb = G.bakeBuilder; G.bakeBuilder = function (b, o) { rec.push(all(b)); return bb(b, o); };
  const R = {};
  const SENT_RAR = 0x0b0010;
  for (const id of ['pistol', 'dual', 'shotgun', 'ar', 'smg', 'sniper', 'rocket']) { rec.length = 0; G._buildWeapon(id, SENT_RAR); R['w_' + id] = rec.slice(); }
  for (const id of ['pick', 'axe', 'shovel', 'sickle', 'hammer']) { rec.length = 0; G._buildPick(id); R['p_' + id] = rec.slice(); }
  rec.length = 0; G.makeGlider(0x0b0020); R.glider = rec.slice();
  rec.length = 0; G.makeBus(); R.bus = rec.slice();
  const SENT = { tone: 0x0b0001, shirt: 0x0b0002, acc: 0x0b0003, pants: 0x0b0004, hairC: 0x0b0005 };
  R.chars = {};
  G.OUTFITS.forEach((O, i) => {
    const E = G._segGeos(Object.assign({ outfit: i }, SENT)); const S = E.S;
    R.chars[O.id] = { outfit: O, defaults: { skin: 0xf2c9a0, top: O.top, top2: O.top2, pants: O.pants, hair: O.hairC || 0x3a2a1a },
      torso: all(S.torso), head: all(S.head), uarm: S.uarm.map(all), farm: S.farm.map(all), thigh: S.thigh.map(all), shin: S.shin.map(all) };
  });
  R.sent = SENT; R.sentRarity = SENT_RAR; R.sentGlider = 0x0b0020;
  return R;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(base + '/index.html?noassets')
    pg.wait_for_function('window.G && G.makeBus && G._buildPick && G._segGeos && G.OUTFITS', timeout=60000)
    R = pg.evaluate(JS)
    b.close()
os.makedirs(out, exist_ok=True)
for k, v in R.items():
    if k == 'chars':
        json.dump(v, open(os.path.join(out, 'chars.json'), 'w'), separators=(',', ':'))
    elif k.startswith(('sent',)):
        pass
    else:
        json.dump(v, open(os.path.join(out, k + '.json'), 'w'), separators=(',', ':'))
json.dump({'sent': R['sent'], 'rarity': R['sentRarity'], 'glider': R['sentGlider']}, open(os.path.join(out, 'sentinels.json'), 'w'))
print('errors', errs, sorted(os.listdir(out)))
