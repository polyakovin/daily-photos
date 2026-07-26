#!/bin/bash

set -uo pipefail

# Stop hooks receive an event object on stdin. The build decision is based on
# Git state, but consuming stdin keeps the hook compatible with piped callers.
hook_input="$(cat)"
stop_hook_active=false
if [[ "$hook_input" =~ \"stop_hook_active\"[[:space:]]*:[[:space:]]*true ]]; then
  stop_hook_active=true
fi

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  printf '%s\n' '{"continue":true,"systemMessage":"Не удалось определить корень Git-репозитория; сборка macOS пропущена."}'
  exit 0
}

cd "$repo_root" || {
  printf '%s\n' '{"continue":true,"systemMessage":"Не удалось перейти в корень репозитория; сборка macOS пропущена."}'
  exit 0
}

# These paths mirror the inputs packaged by electron-builder.
source_paths=(
  package.json
  package-lock.json
  src
  scripts
  build
)

select_compatible_node() {
  local candidate
  local candidate_dir
  local candidate_version
  local candidate_major
  local candidate_minor

  while IFS= read -r candidate; do
    [[ -x "$candidate" ]] || continue

    candidate_version="$("$candidate" -p 'process.versions.node' 2>/dev/null)" || continue
    candidate_major="${candidate_version%%.*}"
    candidate_minor="${candidate_version#*.}"
    candidate_minor="${candidate_minor%%.*}"

    # Current electron-builder dependencies require Node 22.12 or newer.
    if (( candidate_major > 22 || (candidate_major == 22 && candidate_minor >= 12) )); then
      candidate_dir="$(dirname "$candidate")"
      if [[ -x "$candidate_dir/npm" ]]; then
        PATH="$candidate_dir:$PATH"
        export PATH
        return 0
      fi
    fi
  done < <(type -aP node 2>/dev/null)

  return 1
}

run_macos_build() {
  if ! select_compatible_node; then
    printf '%s\n' "Для macOS-сборки нужен Node.js 22.12 или новее, доступный через PATH."
    return 1
  fi

  printf 'Node.js: %s\n' "$(node --version)"
  printf 'npm: %s\n' "$(npm --version)"
  npm run dist:mac
}

if [[ -z "$(git status --porcelain=v1 --untracked-files=all -- "${source_paths[@]}")" ]]; then
  printf '%s\n' '{"continue":true}'
  exit 0
fi

state_dir="$repo_root/.local/codex-hooks"
state_file="$state_dir/macos-build.state"
log_file="$state_dir/macos-build.log"
if ! mkdir -p "$state_dir"; then
  printf '%s\n' '{"continue":true,"systemMessage":"Не удалось создать .local/codex-hooks; сборка macOS пропущена."}'
  exit 0
fi

# Hash both tracked diffs and untracked source files. This makes repeated Stop
# events cheap while still rebuilding after any relevant content change.
source_digest="$(
  {
    git diff --binary --no-ext-diff HEAD -- "${source_paths[@]}"
    while IFS= read -r -d '' untracked_file; do
      printf '\0%s\0' "$untracked_file"
      git hash-object "$untracked_file"
    done < <(git ls-files --others --exclude-standard -z -- "${source_paths[@]}")
  } | git hash-object --stdin
)"

previous_state=""
if [[ -f "$state_file" ]]; then
  previous_state="$(<"$state_file")"
fi

if [[ "$previous_state" == "success $source_digest" ]]; then
  printf '%s\n' '{"continue":true}'
  exit 0
fi

if run_macos_build >"$log_file" 2>&1; then
  printf 'success %s\n' "$source_digest" >"$state_file"
  tail -n 40 "$log_file" >&2
  printf '%s\n' '{"continue":true}'
  exit 0
else
  tail -n 120 "$log_file" >&2
  if [[ "$stop_hook_active" == true ]]; then
    printf '%s\n' '{"continue":true,"systemMessage":"Повторная автоматическая сборка macOS завершилась ошибкой. Лог: .local/codex-hooks/macos-build.log"}'
  else
    printf '%s\n' '{"decision":"block","reason":"Автоматическая сборка macOS завершилась ошибкой. Изучи .local/codex-hooks/macos-build.log, исправь причину и снова проверь сборку."}'
  fi
  exit 0
fi
