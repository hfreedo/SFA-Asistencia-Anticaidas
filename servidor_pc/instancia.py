"""Single launcher window per application folder and port on Windows."""
import ctypes
from ctypes import wintypes
import hashlib
import os


def acquire(home, port):
    if os.name != 'nt':
        return None, False
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    kernel.CreateMutexW.argtypes = (ctypes.c_void_p, wintypes.BOOL, wintypes.LPCWSTR)
    kernel.CreateMutexW.restype = wintypes.HANDLE
    kernel.CloseHandle.argtypes = (wintypes.HANDLE,)
    identity = hashlib.sha256((str(home).casefold() + ':' + str(port)).encode()).hexdigest()[:24]
    handle = kernel.CreateMutexW(None, False, 'Local\\SFAAsistencia-' + identity)
    if not handle:
        raise OSError(ctypes.get_last_error(), 'No se pudo verificar la instancia de SFA')
    if ctypes.get_last_error() == 183:
        kernel.CloseHandle(handle)
        return None, True
    return (kernel, handle), False


def release(lease):
    if lease:
        kernel, handle = lease
        kernel.CloseHandle(handle)


def focus_existing():
    if os.name != 'nt':
        return
    user = ctypes.WinDLL('user32', use_last_error=True)
    user.FindWindowW.argtypes = (wintypes.LPCWSTR, wintypes.LPCWSTR)
    user.FindWindowW.restype = wintypes.HWND
    user.ShowWindow.argtypes = (wintypes.HWND, ctypes.c_int)
    user.SetForegroundWindow.argtypes = (wintypes.HWND,)
    window = user.FindWindowW(None, 'SFA Asistencia | Centro de inicio')
    if window:
        user.ShowWindow(window, 9)
        user.SetForegroundWindow(window)
