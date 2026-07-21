#!/bin/sh
set -u

commands='check:f1-glitch
check:f1-welcome
check:showroom-resources
check:f1-motion
check:f1-wheel-hold
check:f1-airflow
check:f1-studio
check:f1-reflection
check:f1-showroom-interaction
check:f1-model
check:showroom-assets
check:f1-showroom-v5
lint
build'

status=0
for command in $commands; do
  printf '\n$ npm run %s\n' "$command"
  if npm run "$command"; then
    printf 'RESULT: PASS — npm run %s\n' "$command"
  else
    command_status=$?
    printf 'RESULT: FAIL (%s) — npm run %s\n' "$command_status" "$command"
    status=$command_status
  fi
done

printf '\nFINAL STATUS: %s\n' "$status"
exit "$status"
