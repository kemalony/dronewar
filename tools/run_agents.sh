#!/usr/bin/env bash
# Paket basina AYRI ajan calistirir (paralel).
#
# Ajanlar yalnizca kendi src/<paket>/ klasorune yazar; build ve test
# CALISTIRMAZLAR. Boylece paralel calisirken birbirinin ciktisini bozmazlar;
# derleme ve olcum merkezi olarak orkestrator tarafindan yapilir.
#
# Kullanim:  tools/run_agents.sh world fx units      (paket adlari)
#            tools/run_agents.sh --all
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH="/home/synapso/projects/game/.venv/bin:$PATH"
export QWEN_CODE_SUPPRESS_YOLO_WARNING=1

ALL=(core input audio fx world units game)
if [[ "${1:-}" == "--all" ]]; then PKGS=("${ALL[@]}"); else PKGS=("$@"); fi
[[ ${#PKGS[@]} -eq 0 ]] && { echo "kullanim: run_agents.sh <paket...> | --all"; exit 1; }

for pkg in "${PKGS[@]}"; do
  task="tasks/pkg_${pkg}.md"
  if [[ ! -f "$task" ]]; then
    echo "ATLANDI $pkg: $task yok"; continue
  fi
  echo "=== ajan baslatiliyor: $pkg  $(date '+%H:%M:%S') ==="
  setsid nohup qwen -p "@AGENTS.md @src/${pkg}/AGENTS.md @src/${pkg}/spec.md @${task}
Proje ~/projects/dronewar. Sen '${pkg}' paketinin ajanisin.
YALNIZCA src/${pkg}/ altina yaz. index.html'i elle duzenleme; build ve test calistirma.
Gorevin ${task} dosyasinda. Bitirince kisa ozet yaz ve DUR." \
    --yolo >> "loop_${pkg}.log" 2>&1 < /dev/null &
  disown || true
  sleep 3
done
echo "--- baslatilan ajanlar ---"
ps -eo pid,args | grep "[c]li.js" | grep -o "pkg_[a-z]*\.md" | sort | uniq -c
