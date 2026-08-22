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
SIGNAL_SRC_DIR=''
if [ -n "${BASH_SOURCE[0]-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  _sig_dir="$(dirname -- "${BASH_SOURCE[0]}")/signal"
  if [ -d "$_sig_dir" ]; then
    SIGNAL_SRC_DIR=$(CDPATH= cd -- "$_sig_dir" && pwd)
  fi
  unset _sig_dir
fi
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
      if [ "$port" = "$main_port" ]; then
        continue
      fi
      printf 'aux-server=0.0.0.0:%s\n' "$port"
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
    {'urls': [f'stun:{host}:{p}' for p in prefer + rest] or [f'stun:{host}:{stun_port}']},
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
    python3 - "$PUBLIC_IP" "$TURN_USER" "$TURN_PASS" "$PORTS" "$sig" "$MAIN_PORT" <<'PY'
import json, sys
ip, user, pw, ports, sig, main = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]
port_list = [item for item in ports.split() if item]
prefer = [p for p in ('443', '80', '3478') if p in port_list]
rest = [p for p in port_list if p not in prefer]
ordered = prefer + rest
urls = []
for port in ordered:
    urls.append(f'turn:{ip}:{port}?transport=tcp')
    urls.append(f'turn:{ip}:{port}')
stun_list = [f'stun:{ip}:{p}' for p in ordered]
stun = stun_list[0] if len(stun_list) == 1 else stun_list
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

ensure_socat() {
  if command -v socat >/dev/null 2>&1; then
    return
  fi
  say 'Ставлю socat (нужен acme.sh в режиме standalone).'
  if command -v apt-get >/dev/null 2>&1; then
    as_root apt-get install -y socat cron >/dev/null 2>&1 || true
  elif command -v dnf >/dev/null 2>&1; then
    as_root dnf install -y socat cronie >/dev/null 2>&1 || true
  fi
}

ACME_BIN='/root/.acme.sh/acme.sh'
ACME_STATE_FILE="$INSTALL_DIR/acme.env"

valid_email() {
  printf '%s' "$1" | grep -Eq '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
}

sslip_host() {
  printf 'wss-%s.sslip.io' "$(printf '%s' "$1" | tr '.' '-')"
}

read_acme_state() {
  local key="$1"
  if [ ! -f "$ACME_STATE_FILE" ]; then
    return 0
  fi
  awk -F= -v k="$key" '$1==k {print substr($0, length(k)+2); exit}' "$ACME_STATE_FILE"
}

save_acme_state() {
  umask 077
  mkdir -p "$INSTALL_DIR"
  {
    printf 'email=%s\n' "$1"
    printf 'host=%s\n' "$2"
    printf 'port=%s\n' "$3"
  } >"$ACME_STATE_FILE"
  chmod 600 "$ACME_STATE_FILE"
}

run_acme() {
  as_root env HOME=/root "$ACME_BIN" --home /root/.acme.sh "$@"
}

ensure_cron() {
  if command -v systemctl >/dev/null 2>&1; then
    as_root systemctl enable --now cron >/dev/null 2>&1 || true
    as_root systemctl enable --now crond >/dev/null 2>&1 || true
  fi
  as_root mkdir -p /etc/cron.d
  as_root tee /etc/cron.d/nocloud-acme >/dev/null <<'EOF'
# NoCloud: продление Let’s Encrypt для сокета. TURN на 80 коротко останавливается хуками acme.sh.
MAILTO=""
17 3 * * * root /root/.acme.sh/acme.sh --cron --home /root/.acme.sh >/dev/null 2>&1
EOF
  as_root chmod 644 /etc/cron.d/nocloud-acme
  run_acme --install-cronjob >/dev/null 2>&1 || true
}

ensure_acme() {
  local email="$1"
  if [ -x "$ACME_BIN" ]; then
    return
  fi
  say 'Ставлю acme.sh для сертификата Let’s Encrypt.'
  if ! curl -fsSL 'https://get.acme.sh' | as_root env HOME=/root sh -s email="$email"; then
    echo 'acme.sh не установился.' >&2
    return 1
  fi
  if [ ! -x "$ACME_BIN" ]; then
    echo 'acme.sh не появился в /root/.acme.sh.' >&2
    return 1
  fi
}

copy_signal_file() {
  local name="$1"
  local dest="$2"
  if [ -n "$SIGNAL_SRC_DIR" ] && [ -f "$SIGNAL_SRC_DIR/$name" ]; then
    cp "$SIGNAL_SRC_DIR/$name" "$dest"
    return 0
  fi
  curl -fsSL "$REPO_RAW/deploy/signal/$name" -o "$dest"
}

write_acme_hooks() {
  local dir="$INSTALL_DIR/signal"
  mkdir -p "$dir"
  umask 077
  cat >"$dir/acme-pre.sh" <<EOF
#!/bin/sh
docker stop ${CONTAINER} >/dev/null 2>&1 || true
EOF
  cat >"$dir/acme-post.sh" <<EOF
#!/bin/sh
docker start ${CONTAINER} >/dev/null 2>&1 || true
EOF
  cat >"$dir/acme-reload.sh" <<EOF
#!/bin/sh
docker restart ${SIGNAL_CONTAINER} >/dev/null 2>&1 || true
EOF
  chmod 700 "$dir/acme-pre.sh" "$dir/acme-post.sh" "$dir/acme-reload.sh"
}

signal_cert_usable() {
  local pem="$INSTALL_DIR/signal/tls/fullchain.pem"
  local ident="$1"
  if [ -s "$pem" ] && openssl x509 -in "$pem" -noout -checkend 86400 >/dev/null 2>&1; then
    return 0
  fi
  if as_root test -s "/root/.acme.sh/${ident}_ecc/fullchain.cer" ||
    as_root test -s "/root/.acme.sh/${ident}/fullchain.cer"; then
    return 0
  fi
  return 1
}

issue_signal_cert() {
  local ident="$1"
  local dir="$INSTALL_DIR/signal"
  local pre="$dir/acme-pre.sh"
  local post="$dir/acme-post.sh"
  local extra=''
  if printf '%s' "$ident" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
    extra='--certificate-profile shortlived --days 3'
  fi
  # shellcheck disable=SC2086
  if run_acme --issue --server letsencrypt --standalone -d "$ident" \
    --pre-hook "$pre" --post-hook "$post" $extra; then
    return 0
  fi
  if [ -n "$extra" ]; then
    extra='--cert-profile shortlived --days 3'
    # shellcheck disable=SC2086
    if run_acme --issue --server letsencrypt --standalone -d "$ident" \
      --pre-hook "$pre" --post-hook "$post" $extra; then
      return 0
    fi
  fi
  as_root docker start "$CONTAINER" >/dev/null 2>&1 || true
  if signal_cert_usable "$ident"; then
    say 'Сертификат уже действует — повторный выпуск Let’s Encrypt пропускаю.'
    return 0
  fi
  return 1
}

install_signal() {
  SIGNAL_URL=''
  say ''
  say 'Сокет (signaling): обмен SDP без копирования N1.'
  say 'PWA на GitHub Pages — HTTPS. Браузер не откроет ws://, нужен wss.'
  say 'Имя по умолчанию — wss-<IP>.sslip.io: обычный сертификат ~90 дней, не 6.'
  say 'Email спрашиваем один раз, дальше cron продлевает сам (TURN на 80 на минуту).'
  WANT_SIGNAL='y'
  ask 'Поставить сокет с HTTPS? (Y/n)' WANT_SIGNAL 'y'
  case "$WANT_SIGNAL" in
    n|N|no|NO) return ;;
  esac
  SIG_PORT="$(read_acme_state port)"
  if [ -z "$SIG_PORT" ]; then
    SIG_PORT='8443'
  fi
  ask 'Порт сокета' SIG_PORT "$SIG_PORT"
  if ! valid_port "$SIG_PORT"; then
    echo 'Некорректный порт сокета.' >&2
    return
  fi
  local default_host
  default_host="$(read_acme_state host)"
  if [ -z "$default_host" ]; then
    default_host="$(sslip_host "$PUBLIC_IP")"
  fi
  SIG_HOST="$default_host"
  ask 'Имя в сертификате (Enter = sslip.io / сохранённое)' SIG_HOST "$default_host"
  if [ -z "$SIG_HOST" ]; then
    SIG_HOST="$default_host"
  fi
  ACME_EMAIL="$(read_acme_state email)"
  if [ -n "$ACME_EMAIL" ]; then
    say "Email Let’s Encrypt уже сохранён на VPS: $ACME_EMAIL"
    ask 'Другой email (Enter = оставить)' ACME_EMAIL "$ACME_EMAIL"
  else
    ask 'Email для Let’s Encrypt (один раз, не в git)' ACME_EMAIL
  fi
  if ! valid_email "$ACME_EMAIL"; then
    echo 'Нужен настоящий email — без него сертификат не выпустить.' >&2
    return
  fi
  local dir="$INSTALL_DIR/signal"
  local certs="$dir/tls"
  mkdir -p "$dir" "$certs"
  chmod 700 "$certs"
  if ! copy_signal_file package.json "$dir/package.json"; then
    say 'Не скачался deploy/signal — запушьте main и повторите, или пропустите сокет.'
    return
  fi
  copy_signal_file server.mjs "$dir/server.mjs"
  copy_signal_file Dockerfile "$dir/Dockerfile"
  write_acme_hooks
  ensure_socat
  if ! ensure_acme "$ACME_EMAIL"; then
    return
  fi
  run_acme --register-account -m "$ACME_EMAIL" --server letsencrypt >/dev/null 2>&1 || true
  ensure_cron
  if command -v ufw >/dev/null 2>&1; then
    as_root ufw allow 80/tcp || true
    as_root ufw allow "$SIG_PORT"/tcp || true
  fi
  say 'Выпускаю сертификат (TURN на 80 сейчас остановится на минуту)…'
  if ! issue_signal_cert "$SIG_HOST"; then
    say 'Сертификат не вышел. Сокет без TLS с Pages не работает — не пишу http:// в S1.'
    say 'Проверьте: TCP 80 открыт с интернета, IP верный, лимиты Let’s Encrypt.'
    return
  fi
  if ! run_acme --install-cert -d "$SIG_HOST" \
    --key-file "$certs/privkey.pem" \
    --fullchain-file "$certs/fullchain.pem" \
    --reloadcmd "$dir/acme-reload.sh"; then
    say 'Не удалось положить сертификат в каталог сокета.'
    return
  fi
  as_root docker rm -f "$SIGNAL_CONTAINER" >/dev/null 2>&1 || true
  as_root docker build -t nocloud-signal "$dir"
  as_root docker run -d --name "$SIGNAL_CONTAINER" --restart unless-stopped \
    -p "${SIG_PORT}:${SIG_PORT}" \
    -e "PORT=${SIG_PORT}" \
    -e 'TLS_CERT=/certs/fullchain.pem' \
    -e 'TLS_KEY=/certs/privkey.pem' \
    -v "$certs:/certs:ro" \
    nocloud-signal
  SIGNAL_URL="https://${SIG_HOST}:${SIG_PORT}"
  save_acme_state "$ACME_EMAIL" "$SIG_HOST" "$SIG_PORT"
  say "Сокет: $SIGNAL_URL  (wss, браузер с Pages откроет)"
  say "Продление: cron 03:17, email на VPS в $ACME_STATE_FILE"
}

say '=== NoCloud TURN ==='
say 'Домен не обязателен: TURN на IP, сокет — имя sslip.io и Let’s Encrypt ~90 дней.'
say 'Пароль спросим здесь и не кладём в git.'
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
for p in 443 80 3478; do
  for port in $PORTS; do
    if [ "$port" = "$p" ]; then
      MAIN_PORT="$p"
      break 2
    fi
  done
done
if [ -z "$MAIN_PORT" ]; then
  MAIN_PORT=${PORTS%% *}
fi

write_turn_conf "$MAIN_PORT" "$TURN_USER" "$TURN_PASS" "$PUBLIC_IP"

as_root docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
as_root docker pull "$COTURN_IMAGE"
# Image runs as turnserver; 80/443 need root on host network.
as_root docker run -d --name "$CONTAINER" --restart unless-stopped --network host \
  --user 0 --cap-add NET_BIND_SERVICE \
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
say "listening:     $MAIN_PORT (остальные — alt/aux, контейнер от root)"
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
say 'Сокет в S1. должен быть https://wss-….sslip.io:8443 — тогда Pages откроет wss.'
say 'Сертификат ~90 дней. Продлевает cron на VPS (email спрашиваем один раз). На продление коротко остановится TURN на 80.'
say 'Проверка TURN: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/'
say "Проверка сокета: curl -sS ${SIGNAL_URL:-https://IP:8443}/"
