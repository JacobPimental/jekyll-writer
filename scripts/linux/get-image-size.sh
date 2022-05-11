#!/bin/sh
xclip -selection clipboard -t image/png -o | magick identify -format "%wx%h" -