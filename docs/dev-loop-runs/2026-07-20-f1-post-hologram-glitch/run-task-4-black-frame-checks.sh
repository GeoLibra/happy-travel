#!/bin/sh
set -eu

artifact_root='../../../output/playwright/task-4-verified'

for video in \
  desktop-arrival.webm \
  mobile-arrival-touch.webm \
  desktop-reduced-motion-glitch.webm
do
  printf '\n$ ffprobe %s/%s\n' "$artifact_root" "$video"
  ffprobe -v error -select_streams v:0 -count_frames \
    -show_entries stream=width,height,avg_frame_rate,nb_read_frames:format=duration \
    -of default=nw=1 "$artifact_root/$video"
  printf '$ ffmpeg blackdetect %s/%s\n' "$artifact_root" "$video"
  ffmpeg -hide_banner -i "$artifact_root/$video" \
    -vf blackdetect=d=0.05:pix_th=0.10 -an -f null -
done
