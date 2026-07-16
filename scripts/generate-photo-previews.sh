#!/usr/bin/env bash

set -u

usage() {
  cat <<'EOF'
Использование:
  ./scripts/generate-photo-previews.sh [--size 64-2048] [--quality 1-100] [--overwrite] [<webp-файл|папка>]

Примеры:
  ./scripts/generate-photo-previews.sh
  ./scripts/generate-photo-previews.sh ./content/2026
  ./scripts/generate-photo-previews.sh --size 640 --overwrite ./content

Превью создаются в .local/tmp/previews с той же структурой папок, что и у оригиналов.
По умолчанию обрабатывается весь архив; актуальные превью пропускаются.

Зависимости (macOS): brew install webp ffmpeg
EOF
}

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
CONTENT_ROOT="$PROJECT_ROOT/content"
TMP_ROOT="$PROJECT_ROOT/.local/tmp"
PREVIEW_ROOT="$TMP_ROOT/previews"
size=480
quality=68
overwrite=0
target="$CONTENT_ROOT"

while (($#)); do
  case "$1" in
    --size)
      if (($# < 2)); then
        echo "Ошибка: после --size нужно указать размер." >&2
        exit 2
      fi
      size="$2"
      shift 2
      ;;
    -q|--quality)
      if (($# < 2)); then
        echo "Ошибка: после $1 нужно указать качество." >&2
        exit 2
      fi
      quality="$2"
      shift 2
      ;;
    -f|--overwrite)
      overwrite=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "Ошибка: неизвестная опция $1" >&2
      exit 2
      ;;
    *)
      target="$1"
      shift
      if (($#)); then
        echo "Ошибка: укажите только один файл или папку." >&2
        exit 2
      fi
      ;;
  esac
done

if [[ ! "$size" =~ ^[0-9]+$ ]] || ((size < 64 || size > 2048)); then
  echo "Ошибка: размер должен быть целым числом от 64 до 2048." >&2
  exit 2
fi

if [[ ! "$quality" =~ ^[0-9]+$ ]] || ((quality < 1 || quality > 100)); then
  echo "Ошибка: качество должно быть целым числом от 1 до 100." >&2
  exit 2
fi

if [[ ! -e "$target" ]]; then
  echo "Ошибка: '$target' не существует." >&2
  exit 1
fi

for tool in cwebp ffmpeg ffprobe webpinfo; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Ошибка: не найдена утилита $tool. На macOS: brew install webp ffmpeg" >&2
    exit 1
  fi
done

if [[ -d "$target" ]]; then
  target="$(cd "$target" && pwd -P)"
else
  target="$(cd "$(dirname "$target")" && pwd -P)/$(basename "$target")"
fi

case "$target" in
  "$CONTENT_ROOT"|"$CONTENT_ROOT"/*) ;;
  *)
    echo "Ошибка: можно создавать превью только для файлов внутри архива." >&2
    exit 2
    ;;
esac

created=0
skipped=0
failed=0
processed=0
progress_seen=0
progress_total=0

report_progress() {
  printf 'PHOTO_DAY_PROGRESS previews %d %d\n' "$progress_seen" "$progress_total"
}

finish_progress_item() {
  ((progress_seen += 1))
  report_progress
}

make_preview() {
  local source="$1"
  local relative destination temporary dimensions width height encode_status

  relative="${source#"$CONTENT_ROOT"/}"
  destination="$PREVIEW_ROOT/$relative"
  temporary="${destination%.webp}.tmp.$$.webp"

  if [[ -s "$destination" && "$overwrite" -eq 0 && "$destination" -nt "$source" ]]; then
    ((skipped += 1))
    finish_progress_item
    return
  fi

  dimensions="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
    -of csv=s=x:p=0 "$source" 2>/dev/null | sed -n '1p')"
  width="${dimensions%x*}"
  height="${dimensions#*x}"
  if [[ ! "$width" =~ ^[0-9]+$ || ! "$height" =~ ^[0-9]+$ ]]; then
    printf 'Ошибка чтения размера: %s\n' "$source" >&2
    ((failed += 1))
    finish_progress_item
    return
  fi

  mkdir -p "$(dirname "$destination")"
  encode_status=0
  if ((width > size || height > size)); then
    if ((width >= height)); then
      cwebp -quiet -q "$quality" -m 6 -resize "$size" 0 "$source" -o "$temporary" || encode_status=$?
    else
      cwebp -quiet -q "$quality" -m 6 -resize 0 "$size" "$source" -o "$temporary" || encode_status=$?
    fi
  else
    cwebp -quiet -q "$quality" -m 6 "$source" -o "$temporary" || encode_status=$?
  fi

  if ((encode_status != 0)); then
    rm -f "$temporary"
    if ! ffmpeg -hide_banner -loglevel error -y -i "$source" -frames:v 1 \
      -vf "scale='min(${size},iw)':'min(${size},ih)':force_original_aspect_ratio=decrease" \
      -c:v libwebp -quality "$quality" -compression_level 6 "$temporary"; then
      rm -f "$temporary"
      printf 'Ошибка создания превью: %s\n' "$source" >&2
      ((failed += 1))
      finish_progress_item
      return
    fi
  fi

  if [[ -s "$temporary" ]] && webpinfo -quiet "$temporary" >/dev/null 2>&1; then
    mv -f "$temporary" "$destination"
    ((created += 1))
  else
    rm -f "$temporary"
    printf 'Ошибка проверки превью: %s\n' "$source" >&2
    ((failed += 1))
  fi

  ((processed += 1))
  if ((processed % 250 == 0)); then
    printf 'Создано превью: %d\n' "$processed"
  fi
  finish_progress_item
}

if [[ -f "$target" ]]; then
  if [[ ! "$target" =~ \.[Ww][Ee][Bb][Pp]$ ]]; then
    echo "Ошибка: для отдельного файла поддерживается только WebP." >&2
    exit 2
  fi
  progress_total=1
  report_progress
  make_preview "$target"
elif [[ -d "$target" ]]; then
  while IFS= read -r -d '' _source <&3; do
    ((progress_total += 1))
  done 3< <(find "$target" -type f \
    ! -name '*.orientation-raw.*' ! -name '*.orientation-fixed.*' \
    -iname '*.webp' -print0)
  report_progress
  while IFS= read -r -d '' source <&3; do
    make_preview "$source"
  done 3< <(find "$target" -type f \
    ! -name '*.orientation-raw.*' ! -name '*.orientation-fixed.*' \
    -iname '*.webp' -print0)
else
  echo "Ошибка: '$target' — не обычный файл и не папка." >&2
  exit 1
fi

printf 'Превью: создано %d, пропущено %d, ошибок %d. Папка: %s\n' \
  "$created" "$skipped" "$failed" "$PREVIEW_ROOT"
((failed == 0))
