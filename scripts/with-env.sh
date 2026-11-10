#!/bin/sh
# Loads .env into the environment, then runs the given command.
#
# Bun skips an env file that is a named pipe (for example a .env mounted by
# 1Password), so the shell reads it instead. Regular .env files work too.
# Lines are read as KEY=value, never evaluated, so values may contain $ or spaces.
if [ -e .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      '' | '#'*) continue ;;
      *=*) ;;
      *) continue ;;
    esac
    line=${line#export }
    key=${line%%=*}
    value=${line#*=}
    case "$value" in
      \"*\") value=${value#\"} value=${value%\"} ;;
      \'*\') value=${value#\'} value=${value%\'} ;;
    esac
    export "$key=$value"
  done < .env
fi
exec "$@"
