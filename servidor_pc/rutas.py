"""Resolve project and portable storage independently of the working directory."""
from pathlib import Path


def application_home(executable, source_root, frozen):
    if not frozen:
        return Path(source_root).resolve()
    folder = Path(executable).resolve().parent
    for candidate in (folder, *list(folder.parents)[:2]):
        if (candidate / 'sfa_portable.py').is_file() and (candidate / 'servidor_pc/main.py').is_file():
            return candidate
    return folder


def database_path(home):
    home = Path(home)
    if (home / 'sfa_portable.py').is_file() and (home / 'servidor_pc/main.py').is_file():
        return home / 'servidor_pc/sfa_eventos.sqlite3'
    return home / 'data/sfa_eventos.sqlite3'
