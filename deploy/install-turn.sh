#!/usr/bin/env bash
# NoCloud TURN installer. Interactive. Secrets stay on the VPS, not in git.
# Usage (from the PWA "Мой сервер" screen):
#   curl -fsSL https://raw.githubusercontent.com/org-event/pwa-no-cloud/main/deploy/install-turn.sh | sudo bash
set -euo pipefail

COTURN_IMAGE='coturn/coturn:4.6.2'
INSTALL_DIR='/opt/nocloud-turn'
CONTAINER='nocloud-turn'
SIGNAL_CONTAINER='nocloud-signal'
REPO_RAW='https://raw.githubusercontent.com/org-event/pwa-no-cloud/main'
RELAY_MIN=49160
RELAY_MAX=49200
TTY='/dev/tty'

say() { printf '%s\n' "$*" >"$TTY"; }
ask() {
  local prompt="$1"
  local var="$2"
  local def="${3-}"
  local value=''
  if [ -n "$def" ]; then
    printf '%s [%s]: ' "$prompt" "$def" >"$TTY"
  else
    printf '%s: ' "$prompt" >"$TTY"
  fi
  IFS= read -r value <"$TTY" || true
  if [ -z "$value" ]; then
    value="$def"
  fi
  printf -v "$var" '%s' "$value"
}

if [ ! -e "$TTY" ]; then
  echo 'Нужна интерактивная консоль (/dev/tty). Запустите скрипт на VPS, не в pipe без TTY.' >&2
  exit 1
fi

if [ "$(id -u)" -eq 0 ]; then
  as_root() { "$@"; }
else
  as_root() { sudo "$@"; }
fi

ensure_docker() {
  local pm='' silent_inst='' check_pkgs='' docker_pkg='' dist=''
  if pm=$(command -v apt-get 2>/dev/null); then
    silent_inst='-yq install --install-recommends'
    check_pkgs='-yq update'
    docker_pkg='docker.io'
    dist='debian'
    export DEBIAN_FRONTEND=noninteractive
  elif pm=$(command -v dnf 2>/dev/null); then
    silent_inst='-yq install'
    check_pkgs='-yq check-update'
    docker_pkg='docker'
    dist='fedora'
  elif pm=$(command -v yum 2>/dev/null); then
    silent_inst='-y -q install'
    check_pkgs='-y -q check-update'
    docker_pkg='docker'
    dist='centos'
  elif pm=$(command -v zypper 2>/dev/null); then
    silent_inst='-nq install'
    check_pkgs='-nq refresh'
    docker_pkg='docker'
    dist='suse'
  elif pm=$(command -v pacman 2>/dev/null); then
    silent_inst='-S --noconfirm --noprogressbar --quiet'
    check_pkgs='-Sy'
    docker_pkg='docker'
    dist='archlinux'
  else
    echo 'Пакетный менеджер не найден (apt/dnf/yum/zypper/pacman).' >&2
    exit 1
  fi
  say "Система: $dist, пакетный менеджер: $pm, пакет Docker: $docker_pkg"

  if [ "$dist" = 'debian' ] && [ "$(id -u)" -ne 0 ]; then
    if ! command -v sudo >/dev/null 2>&1; then
      # shellcheck disable=SC2086
      "$pm" $check_pkgs
      # shellcheck disable=SC2086
      "$pm" $silent_inst sudo
    fi
  fi

  if ! command -v docker >/dev/null 2>&1; then
    say 'Docker не найден — устанавливаю, как Amnezia.'
    # shellcheck disable=SC2086
    as_root "$pm" $check_pkgs || true
    # shellcheck disable=SC2086
    as_root "$pm" $silent_inst "$docker_pkg"
    sleep 2
    as_root systemctl enable --now docker || true
    sleep 2
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo 'Docker так и не появился в PATH.' >&2
    exit 1
  fi

  if command -v systemctl >/dev/null 2>&1; then
    if [ "$(as_root systemctl is-active docker 2>/dev/null || true)" != 'active' ]; then
      say 'Docker установлен, но не запущен — стартую.'
      as_root systemctl enable docker || true
      as_root systemctl start docker
      sleep 2
    fi
    if [ "$(as_root systemctl is-active docker 2>/dev/null || true)" != 'active' ]; then
      echo 'Служба docker не запустилась.' >&2
      exit 1
    fi
  fi

  as_root docker --version
}

port_busy() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -lntuH 2>/dev/null | grep -qE ":${port}[[:space:]]" && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1 && return 0
  fi
  return 1
}

valid_port() {
  local port="$1"
  case "$port" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$port" -ge 1 ] && [ "$port" -le 65535 ]
}

parse_ports() {
  local raw="$1"
  raw=$(printf '%s' "$raw" | tr ',;' '  ')
  PORTS=''
  local port='' seen=' '
  for port in $raw; do
    if ! valid_port "$port"; then
      echo "Некорректный порт: $port" >&2
      exit 1
    fi
    case "$seen" in
      *" $port "*) continue ;;
    esac
    seen="$seen$port "
    PORTS="$PORTS$port "
  done
  PORTS=${PORTS%% }
  if [ -z "$PORTS" ]; then
    echo 'Список портов пуст.' >&2
    exit 1
  fi
}

generate_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 12
    return
  fi
  tr -dc 'A-Za-z0-9' </dev/urandom | dd bs=24 count=1 2>/dev/null
}

detect_public_ip() {
  local ip=''
  ip=$(curl -4 -fsS https://api.ipify.org 2>/dev/null || true)
  if [ -z "$ip" ]; then
    ip=$(curl -4 -fsS https://ifconfig.me/ip 2>/dev/null || true)
  fi
  printf '%s' "$ip"
}

write_turn_conf() {
  local main_port="$1"
  local user="$2"
  local pass="$3"
  local public_ip="$4"
  umask 077
  mkdir -p "$INSTALL_DIR"
  {
    printf 'listening-port=%s\n' "$main_port"
    printf 'min-port=%s\n' "$RELAY_MIN"
    printf 'max-port=%s\n' "$RELAY_MAX"
    printf 'fingerprint\n'
    printf 'lt-cred-mech\n'
    printf 'realm=%s\n' "$public_ip"
    printf 'user=%s:%s\n' "$user" "$pass"
    printf 'no-cli\n'
    printf 'no-tls\n'
    printf 'no-dtls\n'
    printf 'no-multicast-peers\n'
    printf 'no-loopback-peers\n'
    printf 'stale-nonce=600\n'
    printf 'total-quota=256\n'
    printf 'user-quota=64\n'
    printf 'listening-ip=0.0.0.0\n'
    printf 'simple-log\n'
    printf 'log-file=stdout\n'
    printf 'external-ip=%s\n' "$public_ip"
    printf 'denied-peer-ip=0.0.0.0-0.255.255.255\n'
    printf 'denied-peer-ip=10.0.0.0-10.255.255.255\n'
    printf 'denied-peer-ip=100.64.0.0-100.127.255.255\n'
    printf 'denied-peer-ip=127.0.0.0-127.255.255.255\n'
    printf 'denied-peer-ip=169.254.0.0-169.254.255.255\n'
    printf 'denied-peer-ip=172.16.0.0-172.31.255.255\n'
    printf 'denied-peer-ip=192.168.0.0-192.168.255.255\n'
    printf 'denied-peer-ip=::1\n'
    local port=''
    for port in $PORTS; do
      if [ "$port" != "$main_port" ]; then
        printf 'aux-server=0.0.0.0:%s\n' "$port"
      fi
    done
  } >"$INSTALL_DIR/turnserver.conf"
}

print_ice_json() {
  local host="$1"
  local user="$2"
  local pass="$3"
  python3 - "$host" "$user" "$pass" "$PORTS" "$MAIN_PORT" <<'PY' 2>/dev/null || print_ice_json_sh "$host" "$user" "$pass"
import json, sys
host, user, pw, ports, stun_port = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
port_list = [item for item in ports.split() if item]
prefer = [p for p in ('443', '80', '3478') if p in port_list]
rest = [p for p in port_list if p not in prefer]
urls = []
for port in prefer + rest:
    urls.append(f'turn:{host}:{port}?transport=tcp')
    urls.append(f'turn:{host}:{port}')
print(json.dumps([
    {'urls': f'stun:{host}:{stun_port}'},
    {'urls': urls, 'username': user, 'credential': pw},
], indent=2))
PY
}

print_ice_json_sh() {
  local host="$1"
  local user="$2"
  local pass="$3"
  local port='' first=1
  printf '[\n  {"urls": "stun:%s:%s"},\n  {\n    "urls": [\n' "$host" "$MAIN_PORT"
  for port in $PORTS; do
    if [ "$first" -eq 1 ]; then
      first=0
    else
      printf ',\n'
    fi
    printf '      "turn:%s:%s?transport=tcp",\n      "turn:%s:%s"' "$host" "$port" "$host" "$port"
  done
  printf '\n    ],\n    "username": "%s",\n    "credential": "%s"\n  }\n]\n' "$user" "$pass"
}

print_share_pack() {
  local sig="${SIGNAL_URL-}"
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$PUBLIC_IP" "$TURN_USER" "$TURN_PASS" "$PORTS" "$sig" <<'PY'
import json, sys
ip, user, pw, ports, sig = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]
port_list = [item for item in ports.split() if item]
prefer = [p for p in ('443', '80', '3478') if p in port_list]
rest = [p for p in port_list if p not in prefer]
urls = []
for port in prefer + rest:
    urls.append(f'turn:{ip}:{port}?transport=tcp')
    urls.append(f'turn:{ip}:{port}')
stun = f'stun:{ip}:{port_list[0]}'
signaling = {'kind': 'websocket', 'url': sig} if sig else {'kind': 'manual'}
draft = {
    'v': 1,
    'signaling': signaling,
    'iceServers': [
        {'urls': stun},
        {'urls': urls, 'username': user, 'credential': pw},
    ],
}
print('S1.' + json.dumps(draft, separators=(',', ':')))
PY
    return
  fi
  printf 'S1.{"v":1,"signaling":{"kind":"manual"},"iceServers":[]}\n'
}

ensure_qrencode() {
  if command -v qrencode >/dev/null 2>&1; then
    return
  fi
  say 'Ставлю qrencode, чтобы напечатать QR для PWA.'
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get install -y qrencode >/dev/null 2>&1 || true
  fi
}

install_signal() {
  SIGNAL_URL=''
  say ''
  say 'Сокет (signaling): обмен SDP без копирования N1. STUN уже в coturn, Google не нужен.'
  say 'TURN занимает 80/443, сокет лучше на 8443.'
  WANT_SIGNAL='n'
  ask 'Поставить сокет? (y/N)' WANT_SIGNAL 'n'
  case "$WANT_SIGNAL" in
    y|Y|yes|YES) ;;
    *) return ;;
  esac
  SIG_PORT='8443'
  ask 'Порт сокета' SIG_PORT '8443'
  if ! valid_port "$SIG_PORT"; then
    echo 'Некорректный порт сокета.' >&2
    return
  fi
  local dir="$INSTALL_DIR/signal"
  mkdir -p "$dir"
  if ! curl -fsSL "$REPO_RAW/deploy/signal/package.json" -o "$dir/package.json"; then
    say 'Не скачался deploy/signal — запушьте main и повторите, или пропустите сокет.'
    return
  fi
  curl -fsSL "$REPO_RAW/deploy/signal/server.mjs" -o "$dir/server.mjs"
  curl -fsSL "$REPO_RAW/deploy/signal/Dockerfile" -o "$dir/Dockerfile"
  as_root docker rm -f "$SIGNAL_CONTAINER" >/dev/null 2>&1 || true
  as_root docker build -t nocloud-signal "$dir"
  as_root docker run -d --name "$SIGNAL_CONTAINER" --restart unless-stopped \
    -p "${SIG_PORT}:${SIG_PORT}" -e "PORT=${SIG_PORT}" nocloud-signal
  if command -v ufw >/dev/null 2>&1; then
    as_root ufw allow "$SIG_PORT"/tcp || true
  fi
  SIGNAL_URL="http://${PUBLIC_IP}:${SIG_PORT}"
  say "Сокет: $SIGNAL_URL  (в PWA WebSocket / HTTP poll)"
}

say '=== NoCloud TURN ==='
say 'Домен не обязателен. Пароль спросим здесь и не кладём в git.'
say ''

ensure_docker

PUBLIC_IP=$(detect_public_ip)
if [ -z "$PUBLIC_IP" ]; then
  ask 'Публичный IPv4 не определился. Введите его' PUBLIC_IP
fi
if [ -z "$PUBLIC_IP" ]; then
  echo 'Нужен публичный IPv4.' >&2
  exit 1
fi
say "Публичный IP: $PUBLIC_IP"

TURN_USER='nocloud'
ask 'Логин TURN' TURN_USER 'nocloud'
if ! printf '%s' "$TURN_USER" | grep -Eq '^[A-Za-z0-9._-]{1,32}$'; then
  echo 'Логин: латиница, цифры, точка, _ или -, до 32 символов.' >&2
  exit 1
fi

say 'Пароль TURN:'
say '  Enter — сгенерировать'
ask 'Пароль (пусто = сгенерировать)' TURN_PASS ''
if [ -z "$TURN_PASS" ]; then
  TURN_PASS=$(generate_password)
  say "Сгенерирован пароль: $TURN_PASS"
fi
if ! printf '%s' "$TURN_PASS" | grep -Eq '^[A-Za-z0-9._~+-]{8,64}$'; then
  echo 'Пароль: 8–64 символа, без пробелов и двоеточия.' >&2
  exit 1
fi

say ''
say 'Порты. 80 и 443 обычно проходят корпоративные сети; 3478 — классический TURN.'
say '  1) 80 и 443  (рекомендуется)'
say '  2) 80, 443 и 3478'
say '  3) только 3478'
say '  4) свой список (через запятую, например 443,3478)'
PORT_CHOICE='1'
ask 'Вариант' PORT_CHOICE '1'
case "$PORT_CHOICE" in
  1) parse_ports '80 443' ;;
  2) parse_ports '80 443 3478' ;;
  3) parse_ports '3478' ;;
  4)
    CUSTOM_PORTS=''
    ask 'Порты' CUSTOM_PORTS '80,443'
    parse_ports "$CUSTOM_PORTS"
    ;;
  *)
    echo 'Неизвестный вариант.' >&2
    exit 1
    ;;
esac

BUSY=''
for port in $PORTS; do
  if port_busy "$port"; then
    BUSY="$BUSY $port"
  fi
done
if [ -n "$BUSY" ]; then
  say "Заняты порты:$BUSY — nginx/caddy или другой сервис. TURN на них не сядет."
  CONTINUE='n'
  ask 'Продолжить всё равно? (y/N)' CONTINUE 'n'
  case "$CONTINUE" in
    y|Y|yes|YES) ;;
    *) exit 1 ;;
  esac
fi

MAIN_PORT=''
for port in $PORTS; do
  if [ "$port" = '3478' ]; then
    MAIN_PORT='3478'
  fi
done
if [ -z "$MAIN_PORT" ]; then
  MAIN_PORT=${PORTS%% *}
fi

write_turn_conf "$MAIN_PORT" "$TURN_USER" "$TURN_PASS" "$PUBLIC_IP"

as_root docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
as_root docker pull "$COTURN_IMAGE"
as_root docker run -d --name "$CONTAINER" --restart unless-stopped --network host \
  -v "$INSTALL_DIR/turnserver.conf:/etc/coturn/turnserver.conf:ro" \
  "$COTURN_IMAGE"

if command -v ufw >/dev/null 2>&1; then
  for port in $PORTS; do
    as_root ufw allow "$port"/tcp || true
    as_root ufw allow "$port"/udp || true
  done
  as_root ufw allow "${RELAY_MIN}:${RELAY_MAX}/udp" || true
fi

install_signal

SHARE_PACK=$(print_share_pack)

umask 077
{
  printf 'host=%s\n' "$PUBLIC_IP"
  printf 'username=%s\n' "$TURN_USER"
  printf 'password=%s\n' "$TURN_PASS"
  printf 'ports=%s\n' "$PORTS"
  printf 'listening-port=%s\n' "$MAIN_PORT"
  printf 'signaling=%s\n' "${SIGNAL_URL:-manual}"
  printf '\n# iceServers JSON\n'
  print_ice_json "$PUBLIC_IP" "$TURN_USER" "$TURN_PASS"
  printf '\n# пакет для QR / PWA\n%s\n' "$SHARE_PACK"
} >"$INSTALL_DIR/credentials.txt"

say ''
say '========== конфигурация =========='
say "IP:            $PUBLIC_IP"
say "Логин TURN:    $TURN_USER"
say "Пароль TURN:   $TURN_PASS"
say "Порты:         $PORTS"
say "listening:     $MAIN_PORT"
say "Сокет:         ${SIGNAL_URL:-нет, приглашение вручную}"
say "Контейнер:     $CONTAINER"
say "Файл на VPS:   $INSTALL_DIR/credentials.txt"
say ''
say 'Пакет S1. — считайте QR в NoCloud → Мой сервер, либо вставьте текст.'
say "$SHARE_PACK"
ensure_qrencode
if command -v qrencode >/dev/null 2>&1; then
  say ''
  printf '%s' "$SHARE_PACK" | qrencode -t ANSIUTF8 >"$TTY"
else
  say 'qrencode нет — сохраните строку S1. и вставьте в PWA.'
fi
say '=================================='
say 'Проверка TURN: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/'
