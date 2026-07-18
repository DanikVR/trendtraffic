# TCP-форвардер Windows->WSL для матинг-воркера: слушает 0.0.0.0:8801 (виден на
# Tailscale-IP), пересылает в WSL:8801. Копия проверенного fwd8802.py (Hotebook) —
# WSL-IP авто-резолвится, settimeout(None) после connect (иначе таймаут коннекта 10с
# рвёт долгие запросы). Кладётся в C:\Users\<user>\trendtraffic-gpu\, запускается из
# start-gpu.bat строкой: start "" /b pythonw "...\fwd8801.py"
import socket, threading, subprocess, time

PORT = 8801
LISTEN = ('0.0.0.0', PORT)
_ip = {'v': None, 'ts': 0}

def wsl_ip():
    now = time.time()
    if _ip['v'] and now - _ip['ts'] < 30:
        return _ip['v']
    try:
        out = subprocess.run(['wsl', '-d', 'Ubuntu', 'hostname', '-I'],
                             capture_output=True, text=True, timeout=15).stdout.strip()
        ip = out.split()[0] if out else None
        if ip:
            _ip['v'] = ip; _ip['ts'] = now
    except Exception:
        pass
    return _ip['v']

def pipe(a, b):
    try:
        while True:
            d = a.recv(65536)
            if not d:
                break
            b.sendall(d)
    except Exception:
        pass
    finally:
        for s in (a, b):
            try: s.close()
            except Exception: pass

def handle(c):
    c.settimeout(None)
    t = None
    for attempt in (0, 1):
        ip = wsl_ip()
        if not ip:
            if attempt: c.close(); return
            _ip['ts'] = 0; continue
        try:
            t = socket.create_connection((ip, PORT), timeout=10)
            t.settimeout(None)   # снять таймаут коннекта — иначе долгий инференс рвётся за 10с
            break
        except Exception:
            _ip['ts'] = 0
    if t is None:
        try: c.close()
        except Exception: pass
        return
    threading.Thread(target=pipe, args=(c, t), daemon=True).start()
    pipe(t, c)

def main():
    srv = socket.socket()
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(LISTEN); srv.listen(128)
    print('forwarding 0.0.0.0:%d -> WSL:%d (wsl-ip=%s)' % (PORT, PORT, wsl_ip()), flush=True)
    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()

if __name__ == '__main__':
    main()
