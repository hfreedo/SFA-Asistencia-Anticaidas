"""Check the current teaching collection without network or private data."""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import hashlib
import json
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('README.md', 'MANUAL_USO_PC.md', 'MANUAL_PORTAL_Y_ANDROID.md',
         'GUIA_STACK_TECNOLOGICO.md', 'GUIA_CODIGO_Y_NEXOS.md',
         'GUIA_EXPOSICION.md', 'COMPROBACION_Y_DIAGNOSTICO.md', 'ESTADO_DOCUMENTACION.md')


def headings(text):
    counts, result = {}, set()
    for line in text.splitlines():
        if not re.match(r'^#{1,6} ', line):
            continue
        label = re.sub(r'`|\*|<[^>]+>', '', line.lstrip('#').strip()).lower()
        label = ''.join(c for c in label if c.isalnum() or c in '_- ' or unicodedata.category(c).startswith('M'))
        slug = label.replace(' ', '-')
        n = counts.get(slug, 0)
        counts[slug] = n + 1
        result.add(slug + (f'-{n}' if n else ''))
    return result


def check(root=ROOT):
    errors, links, diagrams, pictures = [], 0, 0, 0
    for name in NAMES:
        file = root / 'docs' / name
        if not file.exists():
            errors.append(f'Missing {file.relative_to(root)}')
            continue
        text = file.read_text(encoding='utf-8')
        if '\ufffd' in text or '\x00' in text:
            errors.append(f'Encoding: {name}')
        if text.count('\n# ') or not text.startswith('# '):
            errors.append(f'Expected exactly one document title: {name}')
        fences = re.findall(r'^```([^\n]*)', text, re.M)
        if len(fences) % 2:
            errors.append(f'Unclosed code fence: {name}')
        diagrams += sum(f.strip() == 'mermaid' for f in fences)
        pictures += len(re.findall(r'!\[[^\]]+\]\(', text))
        # Code literals are not links; remove fenced code before inspecting Markdown.
        prose = re.sub(r'^```[^\n]*\n.*?^```\s*$', '', text, flags=re.M | re.S)
        for label, raw in re.findall(r'\[([^\]]*)\]\(([^)]+)\)', prose):
            raw = raw.strip().strip('<>')
            if urlsplit(raw).scheme or raw.startswith('//'):
                continue
            links += 1
            path, _, fragment = raw.partition('#')
            destination = (file.parent / unquote(path)).resolve() if path else file
            if not destination.is_relative_to(root.resolve()) or not destination.exists():
                errors.append(f'{name}: broken local link {raw}')
            elif fragment and destination.suffix == '.md':
                if unquote(fragment) not in headings(destination.read_text(encoding='utf-8')):
                    errors.append(f'{name}: missing anchor {raw}')
    manifest = root / 'docs/manuales/capturas/PROCEDENCIA.json'
    if manifest.exists():
        data = json.loads(manifest.read_text(encoding='utf-8'))
        for item in data['captures']:
            path = manifest.parent / item['file']
            if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != item['sha256']:
                errors.append(f'Capture mismatch: {item["file"]}')
    else:
        errors.append('Missing screenshot provenance')
    fragments = {
        'arduino/SFA_Cinturon_Alerta/SFA_Cinturon_Alerta.ino': [
            'emitirEvento("CAIDA_CONFIRMADA", "impacto_postura_inmovilidad");',
            'float zNormalizado = constrain(az / accelTotal, -1.0, 1.0);'],
        'servidor_pc/main.py': ['if parts[2] == "CAIDA_CONFIRMADA": payload["priority"] = "critical"'],
        'interfaz_web/src/IncidentPanel.tsx': ['.rpc("sfa_attend_incident", { p_event: id, p_expected: expected, p_outcome: outcome });'],
        'android_app/app/src/main/java/org/sfa/asistencia/TrackingService.kt': [
            'JSONObject().put("p_device", cloud).put("p_id", id).put("p_sample", JSONObject(payload))',
            'check(result.optString("accepted") == id)'],
        'supabase/migrations/202610210006_incidents.sql': [
            "if p_expected is distinct from current_attention.updated_at then raise exception 'Attention changed' using errcode='40001'; end if;"],
    }
    fragment_count = 0
    for path, snippets in fragments.items():
        source = re.sub(r'\s+', '', (root / path).read_text(encoding='utf-8'))
        for snippet in snippets:
            fragment_count += 1
            if re.sub(r'\s+', '', snippet) not in source:
                errors.append(f'Source contract changed: {path}: {snippet[:60]}')
    if errors:
        print('\n'.join(errors))
        return 1
    print(f'PASS: {len(NAMES)} guides, {links} local links/anchors, {diagrams} Mermaid blocks, '
          f'{pictures} image embeds, {fragment_count} source fragments; screenshot hashes match.')
    return 0


if __name__ == '__main__':
    sys.exit(check(Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT))
