Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Join-Path $root 'resources/icon-source.png'))
$frames = @()
foreach ($size in @(16,24,32,48,64,128,256,512)) {
  $bitmap = New-Object System.Drawing.Bitmap $size,$size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($source,0,0,$size,$size)
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
  if ($size -eq 512) { [IO.File]::WriteAllBytes((Join-Path $root 'resources/icon.png'),$stream.ToArray()) }
  else { $frames += @{ Size=$size; Bytes=$stream.ToArray() } }
  $graphics.Dispose()
  $bitmap.Dispose()
  $stream.Dispose()
}
$source.Dispose()
$output = [IO.File]::Create((Join-Path $root 'resources/icon.ico'))
$writer = New-Object IO.BinaryWriter $output
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$frames.Count)
$offset = 6 + 16 * $frames.Count
foreach ($frame in $frames) {
  $dimension = if ($frame.Size -eq 256) { 0 } else { $frame.Size }
  $writer.Write([byte]$dimension)
  $writer.Write([byte]$dimension)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]32)
  $writer.Write([uint32]$frame.Bytes.Length)
  $writer.Write([uint32]$offset)
  $offset += $frame.Bytes.Length
}
foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
$writer.Dispose()
