$img = Get-Clipboard -Format Image
if(!$img) { exit 1 }
$width = $img.PhysicalDimension.Width
$height = $img.PhysicalDimension.Height
$dimension = "$width" + "x" + "$height"
echo $dimension
