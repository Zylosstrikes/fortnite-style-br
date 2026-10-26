"""Run:  blender -b --python build_all.py -- <output_dir>
Builds every game model and exports .glb files into <output_dir>."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common, spec_models, props
out = common.out_dir(); os.makedirs(out, exist_ok=True)
only = [a for a in sys.argv[sys.argv.index('--') + 2:]] if '--' in sys.argv else []
def want(n): return not only or n in only
if want('weapons'): spec_models.build_weapons(out)
if want('characters'): spec_models.build_characters(out)
if want('glider'): spec_models.build_glider(out)
if want('bus'): spec_models.build_bus(out)
if want('chests'): props.chest(out, 'wood'); props.chest(out, 'metal')
if want('heals'): props.heals(out)
if want('llama'): props.llama(out)
if want('trees'): props.trees(out)
print('ALL DONE')
