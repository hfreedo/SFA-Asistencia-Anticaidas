$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$names = @('SFA_ANDROID_KEYSTORE', 'SFA_ANDROID_KEY_ALIAS', 'SFA_ANDROID_STORE_PASSWORD', 'SFA_ANDROID_KEY_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function Read-ProcessSecret([string]$name, [string]$prompt) {
    $secure = Read-Host $prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        [Environment]::SetEnvironmentVariable($name, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer), 'Process')
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secure.Dispose()
    }
}

try {
    $keyPath = Read-Host 'Ruta absoluta del keystore privado (fuera del proyecto)'
    if (-not [IO.Path]::IsPathRooted($keyPath) -or -not (Test-Path -LiteralPath $keyPath -PathType Leaf)) {
        throw 'Indica un archivo de firma existente con ruta absoluta'
    }
    $env:SFA_ANDROID_KEYSTORE = (Resolve-Path -LiteralPath $keyPath).Path
    $env:SFA_ANDROID_KEY_ALIAS = Read-Host 'Alias de la clave release'
    Read-ProcessSecret 'SFA_ANDROID_STORE_PASSWORD' 'Contrasena del keystore'
    Read-ProcessSecret 'SFA_ANDROID_KEY_PASSWORD' 'Contrasena de la clave'
    $python = Join-Path $root '.venv313/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $python)) { throw 'Prepara .venv313 segun docs/DESARROLLO.md' }
    & $python (Join-Path $PSScriptRoot 'validar_android.py') --variant release
    if ($LASTEXITCODE -ne 0) { throw 'Compilacion release fallida; revisa android_app/artifacts/release/build.log' }
    Write-Host 'APK generada en android_app/artifacts/release. Verifica firma y version antes de publicar.'
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
