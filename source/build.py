"""Сглобява index.html от частите в src/.
   python3 build.py            -> index.html за преглед (с тестовия превключвател)
   python3 build.py --release  -> index.html без тестовия превключвател (за издаване)"""
import os,re,sys
here=os.path.dirname(os.path.abspath(__file__));src=os.path.join(here,'src')
rel='--release' in sys.argv
out=[]
for line in open(os.path.join(src,'index.template.html'),encoding='utf-8').read().split('\n'):
    m=re.fullmatch(r'@@include (.+)@@',line)
    if not m:out.append(line);continue
    f=m.group(1)
    if rel and f.startswith('test/'):continue
    out.append(open(os.path.join(src,f),encoding='utf-8').read())
dst=os.path.join(here,'dist','index.release.html' if rel else 'index.html')
os.makedirs(os.path.dirname(dst),exist_ok=True)
open(dst,'w',encoding='utf-8').write('\n'.join(out))
print(dst)
