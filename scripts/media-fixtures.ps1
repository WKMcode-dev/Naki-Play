param([string]$OriginalPath)
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
$fixturePath = Join-Path $projectPath '.tools/compatibility-fixtures'
New-Item -ItemType Directory -Force -Path $fixturePath | Out-Null
$ffmpegPath = Join-Path $projectPath 'plugins/naki-media/binaries/ffmpeg-x86_64-pc-windows-msvc.exe'
$probePath = Join-Path $projectPath 'plugins/naki-media/binaries/ffprobe-x86_64-pc-windows-msvc.exe'
function Invoke-FixtureTool([string[]]$ToolArgs) {
    & $ffmpegPath @ToolArgs
    if ($LASTEXITCODE -ne 0) { throw "Media fixture operation failed ($LASTEXITCODE)" }
}
$audioCodecs = @{ mp3='libmp3lame'; wav='pcm_s16le'; m4a='aac'; aac='aac'; flac='flac'; ogg='libvorbis'; opus='libopus'; webm='libopus' }
foreach ($entry in $audioCodecs.GetEnumerator()) {
    Invoke-FixtureTool -ToolArgs @('-nostdin','-v','error','-y','-f','lavfi','-i','sine=frequency=440:duration=1.5','-c:a',$entry.Value,'-threads','1',(Join-Path $fixturePath "sample.$($entry.Key)"))
}
foreach ($ext in @('mp4','mov')) {
    Invoke-FixtureTool -ToolArgs @('-nostdin','-v','error','-y','-f','lavfi','-i','color=c=blue:s=160x120:r=10:d=1.5','-f','lavfi','-i','sine=frequency=440:duration=1.5','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-threads','1','-shortest',(Join-Path $fixturePath "sample.$ext"))
}
if ($OriginalPath) {
    # Read-only input. The user's file is never renamed, modified, or committed.
    $original = (Resolve-Path -LiteralPath $OriginalPath).Path
    Invoke-FixtureTool -ToolArgs @('-nostdin','-v','error','-xerror','-threads','1','-i',$original,'-f','null','-')
    $converted = Join-Path $fixturePath 'reported-audio-compatible.m4a'
    Invoke-FixtureTool -ToolArgs @('-nostdin','-v','error','-xerror','-y','-protocol_whitelist','file,pipe','-threads','1','-i',$original,'-map','0:a:0','-vn','-c:a','aac','-b:a','192k','-ac','2','-ar','48000','-threads','1','-movflags','+faststart','-f','ipod',$converted)
    Invoke-FixtureTool -ToolArgs @('-nostdin','-v','error','-xerror','-threads','1','-i',$converted,'-f','null','-')
    & $probePath -v error -show_entries 'format=format_name,duration:stream=codec_name,codec_type,sample_rate,channels' -of json $converted
}
$env:NAKI_MEDIA_FIXTURES = $fixturePath
$env:CARGO_BUILD_JOBS = '1'
cargo test --manifest-path (Join-Path $projectPath 'backend/Cargo.toml') --lib --offline -j 1
if ($LASTEXITCODE -ne 0) { throw 'Rust compatibility tests failed' }
Write-Output "Fixtures and checks completed: $fixturePath"
