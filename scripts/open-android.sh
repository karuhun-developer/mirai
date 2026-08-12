#!/usr/bin/env bash
#
# Membuka project Android (Capacitor) di Android Studio Windows — dari WSL.
#
# Build web + sync dijalankan dulu supaya `android/app/src/main/assets/public`
# berisi kode terbaru; tanpa itu Studio memasang APK dengan bundel lama tanpa
# keluhan apa pun. Studio-nya sendiri dipanggil lewat path Windows hasil
# `wslpath -w`, karena studio64.exe tidak mengerti path /var/www.
#
# Pakai:  pnpm android:open   (lihat package.json)  atau  bash scripts/open-android.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

STUDIO="${STUDIO:-/mnt/c/Program Files/Android/Android Studio/bin/studio64.exe}"
if [[ ! -f "$STUDIO" ]]; then
  echo "✗ Android Studio tidak ketemu di: $STUDIO" >&2
  echo "  Set variabel lingkungan STUDIO kalau lokasinya beda:" >&2
  echo "    STUDIO=/mnt/c/... pnpm android:open" >&2
  exit 1
fi

echo "→ Build web + sync ke apps/app/android ..."
pnpm build
pnpm --filter @mirai/app exec cap sync android

WIN_ANDROID="$(wslpath -w "$ROOT/apps/app/android")"
echo "→ Membuka Android Studio: $WIN_ANDROID"
# nohup + disown supaya Studio jalan mandiri dan terminal WSL bebas lagi.
nohup "$STUDIO" "$WIN_ANDROID" >/dev/null 2>&1 &
disown
echo "✔ Android Studio sedang dibuka. Tunggu Gradle sync selesai, colok HP, lalu Run ▶."
