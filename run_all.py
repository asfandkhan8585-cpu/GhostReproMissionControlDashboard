"""GhostRepro Unified Dual-Stack Server Launcher.

Runs:
1. FastAPI Backend on port 8000 (with IPv4 and IPv6 localhost support)
2. Vite React Mission Control Dashboard on port 8443 (with IPv4 and IPv6 localhost support)
3. Compatibility port 5173 forwarder (for standard Vite previewers)
"""

import os
import sys
import time
import socket
import select
import threading
import subprocess

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

def tcp_forward(src_sock, dst_sock):
    """Forward data bidirectionally between two sockets."""
    try:
        while True:
            r, _, _ = select.select([src_sock, dst_sock], [], [], 5.0)
            if not r:
                continue
            if src_sock in r:
                data = src_sock.recv(65536)
                if not data:
                    break
                dst_sock.sendall(data)
            if dst_sock in r:
                data = dst_sock.recv(65536)
                if not data:
                    break
                src_sock.sendall(data)
    except Exception:
        pass
    finally:
        try:
            src_sock.close()
        except Exception:
            pass
        try:
            dst_sock.close()
        except Exception:
            pass

def start_tcp_bridge(listen_ip: str, listen_port: int, target_ip: str, target_port: int, family=socket.AF_INET):
    """Listens on a socket and forwards connections to target."""
    def server_thread():
        try:
            srv = socket.socket(family, socket.SOCK_STREAM)
            srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            srv.bind((listen_ip, listen_port))
            srv.listen(128)
            while True:
                client, _ = srv.accept()
                try:
                    target = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    target.connect((target_ip, target_port))
                    t = threading.Thread(target=tcp_forward, args=(client, target), daemon=True)
                    t.start()
                except Exception as e:
                    try:
                        client.close()
                    except Exception:
                        pass
        except Exception as e:
            pass

    t = threading.Thread(target=server_thread, daemon=True)
    t.start()
    return t

def main():
    print("=" * 60)
    print("GhostRepro Mission Control Server Launcher")
    print("=" * 60)

    # 1. Start FastAPI Backend
    print("[1/3] Starting FastAPI Backend on port 8000...")
    backend_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=BACKEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )

    # 2. Start Vite Frontend
    print("[2/3] Starting Vite React Dashboard on port 8443...")
    vite_bin = os.path.join(ROOT_DIR, "node_modules", "vite", "bin", "vite.js")
    frontend_proc = subprocess.Popen(
        ["node", vite_bin, "--host", "0.0.0.0", "--port", "8443"],
        cwd=ROOT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )

    # Stream logs in background
    def pipe_logs(proc, prefix):
        for line in iter(proc.stdout.readline, ''):
            if line.strip():
                print(f"[{prefix}] {line.strip()}", flush=True)

    threading.Thread(target=pipe_logs, args=(backend_proc, "Backend"), daemon=True).start()
    threading.Thread(target=pipe_logs, args=(frontend_proc, "Frontend"), daemon=True).start()

    # Wait 2 seconds for servers to bind
    time.sleep(2)

    # 3. Setup Dual-Stack IPv6 Bridges & Port 5173 Forwarders
    print("[3/3] Configuring Dual-Stack IPv4/IPv6 & Port Forwarders...")
    # Bridge IPv6 localhost [::1]:8443 -> IPv4 127.0.0.1:8443
    start_tcp_bridge("::1", 8443, "127.0.0.1", 8443, family=socket.AF_INET6)
    # Bridge IPv6 localhost [::1]:8000 -> IPv4 127.0.0.1:8000
    start_tcp_bridge("::1", 8000, "127.0.0.1", 8000, family=socket.AF_INET6)
    # Forward Port 5173 (IPv4 & IPv6) -> Port 8443
    start_tcp_bridge("0.0.0.0", 5173, "127.0.0.1", 8443, family=socket.AF_INET)
    start_tcp_bridge("::1", 5173, "127.0.0.1", 8443, family=socket.AF_INET6)

    print("\n" + "=" * 60)
    print("ALL SERVERS ONLINE & ACCESSIBLE:")
    print("=" * 60)
    print("Dashboard (Primary):       http://localhost:8443/")
    print("Dashboard (Direct IPv4):   http://127.0.0.1:8443/")
    print("Dashboard (Alt Port 5173): http://localhost:5173/")
    print("Dashboard (Alt IPv4 5173): http://127.0.0.1:5173/")
    print("Backend API:               http://localhost:8000/")
    print("Backend API (IPv4):        http://127.0.0.1:8000/")
    print("Swagger API Docs:          http://localhost:8000/docs")
    print("=" * 60 + "\n", flush=True)

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None or frontend_proc.poll() is not None:
                break
    except KeyboardInterrupt:
        pass
    finally:
        try:
            backend_proc.terminate()
            frontend_proc.terminate()
        except Exception:
            pass

if __name__ == "__main__":
    main()
