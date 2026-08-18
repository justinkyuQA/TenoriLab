#!/data/data/com.termux/files/usr/bin/bash

cd "$HOME/projects/TenoriLab" || exit 1

PORT=8767

mkdir -p runtime

pkill -f "python.*http.server.*$PORT" \
  2>/dev/null || true

python -m http.server "$PORT" \
  --bind 127.0.0.1 \
  > runtime/server.log 2>&1 &

PID=$!

sleep 1

if ! kill -0 "$PID" 2>/dev/null; then
    echo "TENORI SERVER FAILED"
    cat runtime/server.log
    exit 1
fi

echo
echo "=============================="
echo "       TENORI LAB"
echo "=============================="
echo
echo "✓ PID $PID"
echo "✓ http://127.0.0.1:$PORT"
echo

termux-open-url \
  "http://127.0.0.1:$PORT/?fresh=$(date +%s)" \
  2>/dev/null || \
am start \
  -a android.intent.action.VIEW \
  -d "http://127.0.0.1:$PORT/" \
  >/dev/null 2>&1

echo "TENORI READY"
