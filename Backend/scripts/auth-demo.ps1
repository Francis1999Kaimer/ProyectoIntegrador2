param([ValidateSet("seed", "test")][string]$Action)
$ErrorActionPreference = "Stop"
$securePassword = Read-Host "Clave para cuentas demo (minimo 12 caracteres)" -AsSecureString
$pointer = [IntPtr]::Zero
$previousPassword = [Environment]::GetEnvironmentVariable("DEMO_PASSWORD", "Process")
try {
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $env:DEMO_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  if ($Action -eq "seed") {
    node scripts/seed-demo-users.cjs
  } else {
    node scripts/auth-smoke.cjs
  }
  $code = $LASTEXITCODE
} finally {
  [Environment]::SetEnvironmentVariable("DEMO_PASSWORD", $previousPassword, "Process")
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $securePassword.Dispose()
}
exit $code
