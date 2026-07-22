# English voice via Windows SAPI (no download). Writes next to this script: refs/eng_v1.wav
Add-Type -AssemblyName System.Speech
$out = Join-Path $PSScriptRoot 'refs\eng_v1.wav'
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = -3
$s.SetOutputToWaveFile($out)
$s.Speak('In the east, may Tara keep me. She of Kamarupa dwelling. Southeast, Shodashi will guard me. In the south, Dhumavati reigns.')
$s.Dispose()
Write-Output "wrote $out"
