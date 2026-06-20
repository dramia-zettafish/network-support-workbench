param(
  [string]$OutputPath = ".local-system-metrics.json",
  [int]$IntervalSeconds = 2
)

$ErrorActionPreference = "Stop"
$resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

function Write-SnapshotJson {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Snapshot,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $json = $Snapshot | ConvertTo-Json -Depth 4 -Compress
  $tempPath = "$Path.tmp"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($tempPath, $json, $utf8NoBom)
  Move-Item -LiteralPath $tempPath -Destination $Path -Force
}

while ($true) {
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    $logicalCores = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
    $cpuSamples = Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 2
    $cpuValue = ($cpuSamples.CounterSamples | Select-Object -Last 1).CookedValue
    $totalBytes = [int64]$os.TotalVisibleMemorySize * 1024
    $freeBytes = [int64]$os.FreePhysicalMemory * 1024
    $usedBytes = $totalBytes - $freeBytes
    if ($usedBytes -lt 0) {
      $usedBytes = 0
    }

    $snapshot = [ordered]@{
      timestamp = (Get-Date).ToUniversalTime().ToString("o")
      source = "windows-perfcounter"
      cpu = @{
        usagePercent = [Math]::Round([double]$cpuValue, 2)
        logicalCores = [int]$logicalCores
      }
      memory = @{
        totalBytes = $totalBytes
        usedBytes = $usedBytes
        freeBytes = $freeBytes
        usedPercent = if ($totalBytes -gt 0) { ($usedBytes / $totalBytes) * 100 } else { 0 }
      }
    }

    Write-SnapshotJson -Snapshot $snapshot -Path $resolvedOutput
  } catch {
    $errorSnapshot = [ordered]@{
      timestamp = (Get-Date).ToUniversalTime().ToString("o")
      source = "windows-perfcounter"
      error = $_.Exception.Message
    }
    Write-SnapshotJson -Snapshot $errorSnapshot -Path $resolvedOutput
  }

  Start-Sleep -Seconds $IntervalSeconds
}
