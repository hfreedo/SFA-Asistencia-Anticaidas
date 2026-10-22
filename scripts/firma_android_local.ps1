param([switch]$Build)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$folder = Join-Path $env:USERPROFILE '.sfa/android-signing'
$key = Join-Path $folder 'sfa-release.jks'
$passwordFile = Join-Path $folder 'password.dpapi.xml'
$alias = 'sfa-release'
$javaHome = $env:JAVA_HOME
if (-not $javaHome) { $javaHome = 'C:/Program Files/Android/Android Studio/jbr' }
$keytool = Join-Path $javaHome 'bin/keytool.exe'
if (-not (Test-Path -LiteralPath $keytool)) { throw 'Configura JAVA_HOME con un JDK que incluya keytool' }
$names = @('SFA_ANDROID_KEYSTORE', 'SFA_ANDROID_KEY_ALIAS', 'SFA_ANDROID_STORE_PASSWORD', 'SFA_ANDROID_KEY_PASSWORD')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

try {
    if (-not (Test-Path -LiteralPath $folder)) {
        New-Item -ItemType Directory -Path $folder | Out-Null
    }
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($sid)
    foreach ($identity in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $folder -AclObject $acl
    $hasKey = Test-Path -LiteralPath $key
    $hasPassword = Test-Path -LiteralPath $passwordFile
    if ($hasKey -xor $hasPassword) { throw 'Firma incompleta: no se reemplazara ningun secreto existente' }
    if (-not $hasKey) {
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $plain = [Convert]::ToBase64String($bytes)
        $secure = ConvertTo-SecureString $plain -AsPlainText -Force
        $secure | Export-Clixml -LiteralPath $passwordFile
        $plain = $null
    } else {
        $secure = Import-Clixml -LiteralPath $passwordFile
    }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $env:SFA_ANDROID_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        $env:SFA_ANDROID_KEY_PASSWORD = $env:SFA_ANDROID_STORE_PASSWORD
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secure.Dispose()
    }
    $env:SFA_ANDROID_KEYSTORE = $key
    $env:SFA_ANDROID_KEY_ALIAS = $alias
    if (-not $hasKey) {
        & $keytool -genkeypair -noprompt -keystore $key -storetype JKS -alias $alias -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=SFA Asistencia, OU=Android Distribution, O=SFA Asistencia' -storepass:env SFA_ANDROID_STORE_PASSWORD -keypass:env SFA_ANDROID_KEY_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la clave; revisar antes de reintentar' }
    }
    & $keytool -list -keystore $key -alias $alias -storepass:env SFA_ANDROID_STORE_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'La identidad de firma no se pudo verificar' }
    Write-Host 'Firma privada conservada fuera del repositorio; contrasena protegida con DPAPI del usuario Windows.'
    if ($Build) {
        & (Join-Path $root '.venv313/Scripts/python.exe') (Join-Path $PSScriptRoot 'validar_android.py') --variant release
        if ($LASTEXITCODE -ne 0) { throw 'Build release fallido; no publicar una APK anterior' }
    }
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
