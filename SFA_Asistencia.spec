# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

project_dir = Path(SPECPATH)


a = Analysis(
    [str(project_dir / 'sfa_portable.py')],
    pathex=[str(project_dir)],
    binaries=[],
    datas=[
        (str(project_dir / 'interfaz_web' / 'static'), 'interfaz_web/static'),
        (str(project_dir / 'interfaz_web' / 'dist-acceso'), 'interfaz_web/dist-acceso'),
        (str(project_dir / 'interfaz_web' / 'public' / 'assets' / 'sfa-asistencia-logo.png'), 'interfaz_web/public/assets'),
    ],
    hiddenimports=['uvicorn.logging', 'uvicorn.loops.auto', 'uvicorn.protocols.http.auto', 'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan.on'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='SFA_Asistencia',
    icon=str(project_dir / 'interfaz_web' / 'public' / 'assets' / 'sfa-asistencia.ico'),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
