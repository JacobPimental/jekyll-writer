#!/bin/sh
DIR="$(dirname $1)"
mkdir -p $DIR
xclip -selection clipboard -t image/png -o | magick - -resize $2 $1
if [[ ! -s $1 ]]
then
    rm $1
    echo "File is not image" >&2 
fi