$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$prefix = "http://127.0.0.1:8765/"

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".csv" = "text/csv; charset=utf-8"
}

function Send-Response {
  param(
    [System.Net.HttpListenerContext]$Context,
    [int]$StatusCode,
    [byte[]]$Body,
    [string]$ContentType
  )

  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentLength64 = $Body.Length
  $Context.Response.OutputStream.Write($Body, 0, $Body.Length)
  $Context.Response.OutputStream.Close()
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Start-Process "$($prefix)app-finanzas/index.html"
Write-Host "IA Finanzas disponible en $($prefix)app-finanzas/index.html"
Write-Host "Presiona Ctrl+C para detener la app local."

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))

    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = "app-finanzas/index.html"
    }

    $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    $rootPath = [System.IO.Path]::GetFullPath($root.Path)

    if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $context 403 ([System.Text.Encoding]::UTF8.GetBytes("Forbidden")) "text/plain; charset=utf-8"
      continue
    }

    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      Send-Response $context 404 ([System.Text.Encoding]::UTF8.GetBytes("Not found")) "text/plain; charset=utf-8"
      continue
    }

    $extension = [System.IO.Path]::GetExtension($fullPath)
    $contentType = if ($contentTypes.ContainsKey($extension)) { $contentTypes[$extension] } else { "application/octet-stream" }
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    Send-Response $context 200 $bytes $contentType
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
