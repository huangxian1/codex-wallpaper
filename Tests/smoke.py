#!/usr/bin/env python3
"""Real-client integration test; no messages are sent and no existing process is killed."""
import os, pathlib, plistlib, subprocess, tempfile, time
root = pathlib.Path(__file__).resolve().parents[1]
app = next((p for p in (pathlib.Path('/Applications/ChatGPT.app'), pathlib.Path('/Applications/Codex.app')) if p.exists()), None)
if app is None:
    raise SystemExit('Codex client not found')
with (app/'Contents/Info.plist').open('rb') as f:
    info = plistlib.load(f)
assert info['CFBundleIdentifier'] == 'com.openai.codex'
exe = app/'Contents/MacOS'/info['CFBundleExecutable']
tool_app = pathlib.Path(os.environ.get('CODEX_WALLPAPER_TEST_APP', str(root/'dist/Codex 壁纸.app')))
tool = tool_app/'Contents/MacOS/CodexWallpaper'
with tempfile.TemporaryDirectory(prefix='codex-wallpaper-test-') as profile:
    process = subprocess.Popen([str(exe), '--user-data-dir='+profile, '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--no-first-run', '--disable-background-timer-throttling'], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        endpoint = pathlib.Path(profile)/'DevToolsActivePort'
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError('Test client exited early')
            if endpoint.exists():
                break
            time.sleep(.25)
        port = int(endpoint.read_text().splitlines()[0])
        time.sleep(6)
        result = subprocess.run([str(tool), '--self-test', str(port), str(process.pid)], check=True, timeout=90, capture_output=True, text=True)
        print(result.stdout, end='')
        if result.stderr: print(result.stderr, end='')
        if 'SELF_TEST_PASSED' not in result.stdout:
            raise RuntimeError('Test process exited without its completion marker')
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                print('Test client did not exit; please close its window. PID:', process.pid)
