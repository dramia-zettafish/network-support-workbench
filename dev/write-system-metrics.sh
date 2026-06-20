#!/usr/bin/env sh
set -eu

output_path="${1:-/tmp/eusupport-system-metrics.json}"
interval_seconds="${2:-2}"
output_dir="$(dirname "$output_path")"
mkdir -p "$output_dir"
case "$interval_seconds" in
  ''|*[!0-9]*) interval_seconds=2 ;;
esac
if [ "$interval_seconds" -lt 1 ]; then
  interval_seconds=1
fi

read_cpu() {
  awk '/^cpu / {
    idle=$5+$6
    total=0
    for (i=2; i<=NF; i++) total += $i
    printf "%s %s\n", idle, total
  }' /proc/stat
}

while true; do
  loop_started_at="$(date +%s)"
  first="$(read_cpu)"
  sleep 1
  second="$(read_cpu)"

  first_idle="$(printf '%s\n' "$first" | awk '{print $1}')"
  first_total="$(printf '%s\n' "$first" | awk '{print $2}')"
  second_idle="$(printf '%s\n' "$second" | awk '{print $1}')"
  second_total="$(printf '%s\n' "$second" | awk '{print $2}')"

  cpu_percent="$(awk -v idle1="$first_idle" -v total1="$first_total" -v idle2="$second_idle" -v total2="$second_total" 'BEGIN {
    total_delta = total2 - total1
    idle_delta = idle2 - idle1
    if (total_delta <= 0) print 0
    else printf "%.2f", ((total_delta - idle_delta) / total_delta) * 100
  }')"

  mem_total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
  mem_available_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
  logical_cores="$(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || echo 1)"

  mem_total_bytes=$((mem_total_kb * 1024))
  mem_free_bytes=$((mem_available_kb * 1024))
  mem_used_bytes=$((mem_total_bytes - mem_free_bytes))
  if [ "$mem_used_bytes" -lt 0 ]; then
    mem_used_bytes=0
  fi

  mem_used_percent="$(awk -v used="$mem_used_bytes" -v total="$mem_total_bytes" 'BEGIN {
    if (total <= 0) print 0
    else printf "%.6f", (used / total) * 100
  }')"

  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  tmp_path="${output_path}.tmp"
  cat > "$tmp_path" <<EOF
{"timestamp":"$timestamp","source":"linux-procfs","cpu":{"usagePercent":$cpu_percent,"logicalCores":$logical_cores},"memory":{"usedBytes":$mem_used_bytes,"usedPercent":$mem_used_percent,"totalBytes":$mem_total_bytes,"freeBytes":$mem_free_bytes}}
EOF
  mv "$tmp_path" "$output_path"

  loop_finished_at="$(date +%s)"
  elapsed_seconds=$((loop_finished_at - loop_started_at))
  sleep_seconds=$((interval_seconds - elapsed_seconds))
  if [ "$sleep_seconds" -gt 0 ]; then
    sleep "$sleep_seconds"
  fi
done
