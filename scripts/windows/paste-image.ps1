$img = Get-Clipboard -Format Image

if(!$img) { exit 1 }

$imgPath = $args[0]
$imgSize = $args[1]

$width = $imgSize.Split("x")[0]
$height = $imgSize.Split("x")[1]

$img.SetResolution($width, $height)

$dir = Split-Path -Path $imgPath
New-Item -ItemType Directory -Force -Path $dir

$img.Save($imgPath)