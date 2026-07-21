#!/usr/bin/env bash

set -u

usage() {
  cat <<'EOF'
Использование:
  ./scripts/images-to-webp.sh [--quality 1-100] [--overwrite] [--delete-source] [--skip-previews] <файл|папка>

Примеры:
  ./scripts/images-to-webp.sh ./content/photo.jpg
  ./scripts/images-to-webp.sh --overwrite ./content/2026
  ./scripts/images-to-webp.sh --quality 90 --overwrite ./content
  ./scripts/images-to-webp.sh --delete-source ./content

Поддерживаются JPG, JPEG, PNG, GIF, AVIF, HEIC и HEIF. Поиск в папке рекурсивный.
Исходники удаляются только с --delete-source и только после проверки WebP.
Уже существующие WebP не перекодируются.
С --skip-previews локальные превью не создаются — этот режим используется десктопным приложением.

Зависимости (macOS): brew install webp ffmpeg libheif exiftool
EOF
}

quality=85
overwrite=0
delete_source=0
skip_previews=0
target=""

while (($#)); do
  case "$1" in
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
    --delete-source)
      delete_source=1
      shift
      ;;
    --skip-previews)
      skip_previews=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      if (($# != 1)); then
        usage >&2
        exit 2
      fi
      target="$1"
      shift
      ;;
    -*)
      echo "Ошибка: неизвестная опция $1" >&2
      exit 2
      ;;
    *)
      if [[ -n "$target" ]]; then
        echo "Ошибка: укажите только один файл или папку." >&2
        exit 2
      fi
      target="$1"
      shift
      ;;
  esac
done

if [[ -z "$target" ]]; then
  usage >&2
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

for tool in cwebp gif2webp ffmpeg webpinfo exiftool; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Ошибка: не найдена утилита $tool. На macOS: brew install webp ffmpeg" >&2
    exit 1
  fi
done

converted=0
skipped=0
failed=0
processed=0
deleted=0
delete_count=0
progress_seen=0
progress_total=0
delete_sources=()
delete_destinations=()
preview_target=""

report_progress() {
  printf 'PHOTO_DAY_PROGRESS conversion %d %d\n' "$progress_seen" "$progress_total"
}

finish_progress_item() {
  ((progress_seen += 1))
  report_progress
}

image_kind() {
  case "$1" in
    *.[Jj][Pp][Gg]) printf 'jpg' ;;
    *.[Jj][Pp][Ee][Gg]) printf 'jpeg' ;;
    *.[Pp][Nn][Gg]) printf 'png' ;;
    *.[Gg][Ii][Ff]) printf 'gif' ;;
    *.[Aa][Vv][Ii][Ff]) printf 'avif' ;;
    *.[Hh][Ee][Ii][Cc]) printf 'heic' ;;
    *.[Hh][Ee][Ii][Ff]) printf 'heif' ;;
    *) return 1 ;;
  esac
}

destination_for() {
  local source="$1"
  local stem="${source%.*}"
  local candidate candidate_kind
  local variants=0
  local kind

  kind="$(image_kind "$source")" || return 1
  shopt -s nullglob
  for candidate in "$stem".*; do
    if candidate_kind="$(image_kind "$candidate")"; then
      ((variants += 1))
    fi
  done
  shopt -u nullglob

  if ((variants > 1)); then
    printf '%s.%s.webp' "$stem" "$kind"
  else
    printf '%s.webp' "$stem"
  fi
}

orientation_filter() {
  case "$1" in
    2) printf 'hflip' ;;
    3) printf 'hflip,vflip' ;;
    4) printf 'vflip' ;;
    5) printf 'transpose=clock,hflip' ;;
    6) printf 'transpose=clock' ;;
    7) printf 'transpose=clock,vflip' ;;
    8) printf 'transpose=cclock' ;;
    *) return 1 ;;
  esac
}

read_orientation() {
  local orientation
  orientation="$(exiftool -s3 -IFD0:Orientation# "$1" 2>/dev/null | sed -n '1p')"
  if [[ -z "$orientation" ]]; then
    orientation="$(exiftool -s3 -XMP-tiff:Orientation# "$1" 2>/dev/null | sed -n '1p')"
  fi
  printf '%s' "$orientation"
}

encode_static_webp() {
  local input="$1"
  local output="$2"
  local orientation filter oriented

  orientation="$(read_orientation "$input")"
  filter="$(orientation_filter "$orientation")" || filter=""

  if [[ -z "$filter" ]]; then
    cwebp -quiet -q "$quality" -metadata all "$input" -o "$output"
    return
  fi

  oriented="${output%.webp}.oriented.$$.png"
  if ffmpeg -hide_banner -loglevel error -y -noautorotate -i "$input" \
      -vf "$filter" -frames:v 1 "$oriented" \
    && cwebp -quiet -q "$quality" "$oriented" -o "$output" \
    && exiftool -overwrite_original -TagsFromFile "$input" -all:all \
      -IFD0:Orientation= -IFD1:Orientation= -XMP-tiff:Orientation= \
      -IFD0:Orientation#=1 "$output" >/dev/null; then
    rm -f "$oriented"
    return 0
  fi

  rm -f "$oriented" "$output"
  return 1
}

convert_one() {
  local source="$1"
  local kind destination temporary intermediate conversion_status final_orientation

  kind="$(image_kind "$source")" || return
  destination="$(destination_for "$source")" || return
  temporary="${destination%.webp}.tmp.$$.webp"
  intermediate=""
  conversion_status=0

  if ((delete_source)); then
    delete_sources[$delete_count]="$source"
    delete_destinations[$delete_count]="$destination"
    ((delete_count += 1))
  fi

  # Пустой или оборванный файл не считаем готовым результатом.
  if [[ -s "$destination" && "$overwrite" -eq 0 ]]; then
    if ((delete_source == 0)) || webpinfo -quiet "$destination" >/dev/null 2>&1; then
      ((skipped += 1))
      finish_progress_item
      return
    fi
  fi

  case "$kind" in
    jpg|jpeg|png)
      encode_static_webp "$source" "$temporary" || conversion_status=$?
      ;;
    gif)
      gif2webp -quiet -q "$quality" -m 6 -metadata all "$source" -o "$temporary" || conversion_status=$?
      ;;
    avif)
      ffmpeg -hide_banner -loglevel error -y -i "$source" -map_metadata 0 \
        -frames:v 1 -c:v libwebp -quality "$quality" -compression_level 6 "$temporary" || conversion_status=$?
      ;;
    heic|heif)
      if ! command -v heif-convert >/dev/null 2>&1; then
        echo "Ошибка: не найдена heif-convert. На macOS: brew install libheif" >&2
        conversion_status=127
      else
        intermediate="${destination%.webp}.tmp.$$.jpg"
        heif-convert -q "$quality" "$source" "$intermediate" >/dev/null || conversion_status=$?
        if ((conversion_status == 0)); then
          encode_static_webp "$intermediate" "$temporary" || conversion_status=$?
        fi
        rm -f "$intermediate"
      fi
      ;;
  esac

  if ((conversion_status == 0)); then
    final_orientation="$(read_orientation "$temporary")"
    case "$final_orientation" in
      2|3|4|5|6|7|8)
        echo "Ошибка: ориентация не нормализована для $source" >&2
        conversion_status=1
        ;;
    esac
  fi

  if [[ "$conversion_status" -eq 0 && -s "$temporary" ]]; then
    mv -f "$temporary" "$destination"
    ((converted += 1))
  else
    rm -f "$temporary"
    printf 'Ошибка: %s\n' "$source" >&2
    ((failed += 1))
  fi

  ((processed += 1))
  if ((processed % 100 == 0)); then
    printf 'Обработано: %d\n' "$processed"
  fi
  finish_progress_item
}

if [[ -f "$target" ]]; then
  if ! image_kind "$target" >/dev/null; then
    echo "Ошибка: поддерживаются JPG, JPEG, PNG, GIF, AVIF, HEIC и HEIF." >&2
    exit 2
  fi
  preview_target="$(destination_for "$target")"
  progress_total=1
  report_progress
  convert_one "$target"
elif [[ -d "$target" ]]; then
  preview_target="$target"
  while IFS= read -r -d '' _source <&3; do
    ((progress_total += 1))
  done 3< <(find "$target" -type f \
    ! -name '*.orientation-raw.*' ! -name '*.orientation-fixed.*' \( \
    -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o \
    -iname '*.gif' -o -iname '*.avif' -o -iname '*.heic' -o -iname '*.heif' \) -print0)
  report_progress
  while IFS= read -r -d '' source <&3; do
    convert_one "$source"
  done 3< <(find "$target" -type f \
    ! -name '*.orientation-raw.*' ! -name '*.orientation-fixed.*' \( \
    -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o \
    -iname '*.gif' -o -iname '*.avif' -o -iname '*.heic' -o -iname '*.heif' \) -print0)
else
  echo "Ошибка: '$target' — не обычный файл и не папка." >&2
  exit 1
fi

if ((delete_source && delete_count > 0 && failed == 0)); then
  deletion_safe=1
  for destination in "${delete_destinations[@]}"; do
    if [[ ! -s "$destination" ]] || ! webpinfo -quiet "$destination" >/dev/null 2>&1; then
      printf 'Ошибка проверки WebP: %s\n' "$destination" >&2
      deletion_safe=0
    fi
  done

  if ((deletion_safe)); then
    for source in "${delete_sources[@]}"; do
      if rm -- "$source"; then
        ((deleted += 1))
      else
        printf 'Ошибка удаления: %s\n' "$source" >&2
        ((failed += 1))
      fi
    done
  else
    echo "Исходники не удалены: проверка WebP завершилась с ошибкой." >&2
    ((failed += 1))
  fi
fi

if ((skip_previews == 0)); then
  preview_script="$(cd "$(dirname "$0")" && pwd -P)/generate-photo-previews.sh"
  if [[ -x "$preview_script" && -n "$preview_target" ]]; then
    if ! "$preview_script" "$preview_target"; then
      echo "Ошибка: не удалось обновить превью." >&2
      ((failed += 1))
    fi
  else
    echo "Ошибка: не найден исполняемый generate-photo-previews.sh." >&2
    ((failed += 1))
  fi
fi

printf 'Итог: создано %d, пропущено %d, удалено исходников %d, ошибок %d.\n' \
  "$converted" "$skipped" "$deleted" "$failed"
((failed == 0))
