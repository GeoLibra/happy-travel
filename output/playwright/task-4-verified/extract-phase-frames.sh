#!/bin/sh
set -eu

extract() {
  video=$1
  timestamp=$2
  output=$3
  ffmpeg -y -ss "$timestamp" -i "$video" -frames:v 1 "$output" -loglevel error
}

extract desktop-arrival.webm 6.34 desktop-progress-100-hologram-start.png
extract desktop-arrival.webm 10.73 desktop-hologram-completion.png
extract desktop-arrival.webm 10.76 desktop-clean-hold.png
extract desktop-arrival.webm 11.18 desktop-pulse-1.png
extract desktop-arrival.webm 11.80 desktop-pulse-2.png
extract desktop-arrival.webm 12.37 desktop-pulse-3.png
extract desktop-arrival.webm 12.82 desktop-clean-recovery.png
extract desktop-arrival.webm 12.90 desktop-explosion-start.png
extract desktop-arrival.webm 14.14 desktop-explosion-settled.png
extract desktop-arrival.webm 14.40 desktop-reassembly-start.png
extract desktop-arrival.webm 16.65 desktop-reassembly-settled.png

extract mobile-arrival-touch.webm 6.70 mobile-progress-100-hologram-start.png
extract mobile-arrival-touch.webm 11.08 mobile-hologram-completion.png
extract mobile-arrival-touch.webm 11.14 mobile-clean-hold.png
extract mobile-arrival-touch.webm 11.45 mobile-pulse-1.png
extract mobile-arrival-touch.webm 12.06 mobile-pulse-2.png
extract mobile-arrival-touch.webm 12.64 mobile-pulse-3.png
extract mobile-arrival-touch.webm 13.00 mobile-clean-recovery.png
extract mobile-arrival-touch.webm 13.16 mobile-explosion-start.png
extract mobile-arrival-touch.webm 15.00 mobile-explosion-settled.png
extract mobile-arrival-touch.webm 68.30 mobile-reassembly-start.png
extract mobile-arrival-touch.webm 70.00 mobile-reassembly-settled.png

extract desktop-reduced-motion-glitch.webm 12.96 reduced-hologram-completion.png
extract desktop-reduced-motion-glitch.webm 13.06 reduced-clean-hold.png
extract desktop-reduced-motion-glitch.webm 13.40 reduced-pulse-1.png
extract desktop-reduced-motion-glitch.webm 14.01 reduced-pulse-2.png
extract desktop-reduced-motion-glitch.webm 14.59 reduced-pulse-3.png
extract desktop-reduced-motion-glitch.webm 14.93 reduced-clean-recovery.png
