#!/usr/bin/env bash
# Daemon Docker rootless escopado a este repositório (data-root em ./.docker/data).
# Não altera /etc/docker/daemon.json nem o Docker system-wide.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Unix domain sockets têm limite ~108 chars — paths longos quebram containerd rootless.
# NTFS/exFAT não suportam overlayfs rootless — imagens ficam em ~/.atc-d/ (ext4).
project_fs_type() {
  if command -v findmnt >/dev/null 2>&1; then
    local fstype
    fstype="$(findmnt -no FSTYPE --target "$PROJECT_ROOT" 2>/dev/null || true)"
    if [[ -n "$fstype" ]]; then
      echo "$fstype"
      return
    fi
  fi
  stat -f -c %T "$PROJECT_ROOT" 2>/dev/null || echo unknown
}

is_non_native_docker_fs() {
  local fs
  fs="$(project_fs_type)"
  [[ "$fs" == "ntfs" || "$fs" == "ntfs3" || "$fs" == "fuseblk" || "$fs" == "exfat" || "$fs" == "vfat" ]] \
    || [[ "$fs" == UNKNOWN* && "$fs" == *7366746e* ]]
}

project_hash() {
  printf '%s' "$PROJECT_ROOT" | md5sum | awk '{print $1}' | cut -c1-12
}

# containerd rootless falha se containerd-debug.sock exceder ~104 chars.
containerd_debug_sock() {
  echo "$1/run/docker/containerd/containerd-debug.sock"
}

docker_dir_socket_ok() {
  local probe
  probe="$(containerd_debug_sock "$1")"
  ((${#probe} <= 90))
}

resolve_docker_dir() {
  if [[ -n "${TEAMAGENTS_DOCKER_STATE:-}" ]]; then
    echo "$TEAMAGENTS_DOCKER_STATE"
    return
  fi
  hash="$(project_hash)"
  if is_non_native_docker_fs; then
    echo "$HOME/.atc-d/$hash"
    return
  fi
  local candidates=(
    "$PROJECT_ROOT/.docker"
    "$(dirname "$PROJECT_ROOT")/.atc-d/$hash"
    "$HOME/.atc-d/$hash"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if docker_dir_socket_ok "$candidate"; then
      echo "$candidate"
      return
    fi
  done
  echo "$HOME/.atc-d/$hash"
}

DOCKER_DIR="$(resolve_docker_dir)"
RUN_DIR="$DOCKER_DIR/run"
DATA_DIR="$DOCKER_DIR/data"
PID_FILE="$DOCKER_DIR/dockerd-rootless.pid"
LOG_FILE="$DOCKER_DIR/dockerd-rootless.log"
DAEMON_JSON="$DOCKER_DIR/daemon.json"
TEMPLATE="$SCRIPT_DIR/docker/daemon.json.template"

find_rootless_dockerd() {
  if command -v dockerd-rootless.sh >/dev/null 2>&1; then
    command -v dockerd-rootless.sh
    return 0
  fi
  if [[ -x "$HOME/bin/dockerd-rootless.sh" ]]; then
    echo "$HOME/bin/dockerd-rootless.sh"
    return 0
  fi
  if [[ -x "$HOME/.local/bin/dockerd-rootless.sh" ]]; then
    echo "$HOME/.local/bin/dockerd-rootless.sh"
    return 0
  fi
  return 1
}

check_prerequisites() {
  local missing=()
  find_rootless_dockerd >/dev/null || missing+=("dockerd-rootless.sh")
  command -v rootlesskit >/dev/null 2>&1 || missing+=("rootlesskit")
  command -v slirp4netns >/dev/null 2>&1 || command -v vpnkit >/dev/null 2>&1 || missing+=("slirp4netns ou vpnkit")
  command -v docker >/dev/null 2>&1 || missing+=("docker CLI")
  if ((${#missing[@]} > 0)); then
    echo "Erro: Docker rootless não disponível. Faltam: ${missing[*]}" >&2
    echo "" >&2
    echo "Instalação user-level (não altera o Docker system-wide):" >&2
    echo "  https://docs.docker.com/engine/security/rootless/" >&2
    echo "" >&2
    echo "Debian/Ubuntu (exemplo):" >&2
    echo "  curl -fsSL https://get.docker.com/rootless | sh" >&2
    echo "  export PATH=\$HOME/bin:\$PATH" >&2
    return 1
  fi
}

prepare_dirs() {
  mkdir -p "$RUN_DIR" "$DATA_DIR"
  sed "s|__DATA_ROOT__|$DATA_DIR|g" "$TEMPLATE" > "$DAEMON_JSON"
  if [[ "$DOCKER_DIR" != "$PROJECT_ROOT/.docker" ]]; then
    if is_non_native_docker_fs; then
      printf '%s\n' "$DOCKER_DIR" >"$PROJECT_ROOT/.docker-location"
      echo "Nota: clone em $(project_fs_type) — imagens Docker em $DOCKER_DIR (ext4); dados da app em $PROJECT_ROOT/data/"
    elif [[ "$DOCKER_DIR" == "$HOME/.atc-d/"* ]]; then
      printf '%s\n' "$DOCKER_DIR" >"$PROJECT_ROOT/.docker-location"
      echo "Nota: estado Docker em ~/.atc-d (limite de socket Unix): $DOCKER_DIR"
      echo "  Dados da app continuam em $PROJECT_ROOT/data/"
    else
      mkdir -p "$(dirname "$PROJECT_ROOT/.docker")"
      ln -sfn "$DOCKER_DIR" "$PROJECT_ROOT/.docker"
      echo "Nota: estado Docker em path curto (limite de socket Unix): $DOCKER_DIR"
    fi
  fi
}

export_project_docker_env() {
  export XDG_RUNTIME_DIR="$RUN_DIR"
  export DOCKER_HOST="unix://$RUN_DIR/docker.sock"
}

is_running() {
  export_project_docker_env
  if [[ -S "$RUN_DIR/docker.sock" ]] && timeout 5 docker info >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

cmd_start() {
  check_prerequisites
  prepare_dirs
  if is_running; then
    echo "Docker do projeto já está activo (DOCKER_HOST=$DOCKER_HOST)"
    return 0
  fi
  local dockerd_rootless
  dockerd_rootless="$(find_rootless_dockerd)"
  export_project_docker_env
  # Evita herdar DOCKER_HOST do ambiente externo durante o arranque
  unset DOCKER_CONTEXT || true
  nohup "$dockerd_rootless" --config-file "$DAEMON_JSON" >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  local i
  for i in $(seq 1 60); do
    if is_running; then
      echo "Docker rootless do projeto iniciado."
      echo "  DOCKER_HOST=$DOCKER_HOST"
      echo "  data-root=$DATA_DIR"
      return 0
    fi
    sleep 1
  done
  echo "Erro: timeout ao iniciar dockerd-rootless. Ver $LOG_FILE" >&2
  return 1
}

cmd_stop() {
  if [[ -f "$PID_FILE" ]]; then
    local pid
    pid="$(cat "$PID_FILE")"
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  rm -f "$RUN_DIR/docker.sock" 2>/dev/null || true
  echo "Docker rootless do projeto parado."
}

cmd_status() {
  if is_running; then
    echo "running"
    docker info --format '  Server Version: {{.ServerVersion}}'
    echo "  DOCKER_HOST=$DOCKER_HOST"
    echo "  data-root=$DATA_DIR"
    return 0
  fi
  echo "stopped"
  return 1
}

cmd_env() {
  export_project_docker_env
  printf 'export XDG_RUNTIME_DIR=%q\n' "$XDG_RUNTIME_DIR"
  printf 'export DOCKER_HOST=%q\n' "$DOCKER_HOST"
}

usage() {
  echo "Uso: $0 {start|stop|status|env|check}" >&2
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    start) cmd_start ;;
    stop) cmd_stop ;;
    status) cmd_status ;;
    env) cmd_env ;;
    check) check_prerequisites ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
