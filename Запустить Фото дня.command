#!/bin/zsh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
URL="http://127.0.0.1:4173"
STATE_DIR="$PROJECT_DIR/.local"
LOG_FILE="$STATE_DIR/photo-day-server.log"
EXPECTED_SERVER_VERSION="$(/usr/bin/stat -f '%m' "$PROJECT_DIR/src/server/index.js")"
RUNNING_SERVER_VERSION="$(/usr/bin/curl --silent --fail "$URL/api/server-version" 2>/dev/null)"

# Сервер считается актуальным только если поддерживает весь набор API,
# который запрашивает текущий интерфейс. Это не даёт лаунчеру оставить
# работающим промежуточный экземпляр после обновления кода.
if [[ "$RUNNING_SERVER_VERSION" == "$EXPECTED_SERVER_VERSION" ]] \
  && /usr/bin/curl --silent --fail "$URL/api/photos" >/dev/null 2>&1 \
  && /usr/bin/curl --silent --fail "$URL/api/diary" >/dev/null 2>&1 \
  && /usr/bin/curl --silent --fail "$URL/api/highlights" >/dev/null 2>&1 \
  && /usr/bin/curl --silent --fail "$URL/api/blur-dates" >/dev/null 2>&1; then
  /usr/bin/open "$URL"
  exit 0
fi

# Старый экземпляр «Фото дня» может продолжать отвечать после обновления файлов.
# Перезапускаем только его: на порту должен отвечать знакомый API архива.
if /usr/bin/curl --silent --fail "$URL/api/photos" >/dev/null 2>&1; then
  SERVER_PID="$(/usr/sbin/lsof -n -P -tiTCP:4173 -sTCP:LISTEN 2>/dev/null | /usr/bin/head -n 1)"
  if [[ -n "$SERVER_PID" ]]; then
    /bin/kill "$SERVER_PID" 2>/dev/null
    for attempt in {1..40}; do
      if ! /usr/bin/curl --silent --fail "$URL" >/dev/null 2>&1; then
        break
      fi
      /bin/sleep 0.1
    done
  fi
elif /usr/bin/curl --silent --fail "$URL" >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display alert "Не удалось запустить «Фото дня»" message "Порт 4173 занят другим приложением." as critical'
  exit 1
fi

NODE="$(command -v node 2>/dev/null)"
if [[ -z "$NODE" ]]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [[ -x "$candidate" ]]; then
      NODE="$candidate"
      break
    fi
  done
fi

if [[ -z "$NODE" ]]; then
  /usr/bin/osascript -e 'display alert "Не удалось запустить «Фото дня»" message "Node.js не найден. Установите Node.js и попробуйте снова." as critical'
  exit 1
fi

cd "$PROJECT_DIR" || exit 1
/bin/mkdir -p "$STATE_DIR"
/usr/bin/nohup "$NODE" src/server/index.js >>"$LOG_FILE" 2>&1 &

for attempt in {1..80}; do
  if /usr/bin/curl --silent --fail "$URL" >/dev/null 2>&1; then
    /usr/bin/open "$URL"
    exit 0
  fi
  /bin/sleep 0.25
done

/usr/bin/osascript -e 'display alert "Не удалось запустить «Фото дня»" message "Подробности записаны в .local/photo-day-server.log." as critical'
exit 1
