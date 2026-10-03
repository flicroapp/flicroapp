#!/usr/bin/env python3
"""
Live network & Wi-Fi monitor.
Only measured values are reported. Anything that cannot be measured is null.
Windows: netsh wlan. Linux: /proc/net/wireless + iwgetid. macOS: airport.
"""
import json
import platform
import re
import socket
import subprocess
import sys


def run(cmd, timeout=1.5):
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.DEVNULL, timeout=timeout)
    except Exception:
        return ""


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("1.1.1.1", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def wifi(system):
    info = {"connected": None, "signal": None, "ssid": None, "rxMbps": None, "txMbps": None}
    if system == "windows":
        out = run(["netsh", "wlan", "show", "interfaces"])
        if not out:
            return info
        state = re.search(r"^\s*State\s*:\s*(.+)$", out, re.M | re.I)
        signal = re.search(r"^\s*Signal\s*:\s*(\d+)%", out, re.M | re.I)
        ssid = re.search(r"^\s*SSID\s*:\s*(.+)$", out, re.M | re.I)
        rx = re.search(r"Receive rate \(Mbps\)\s*:\s*([\d.]+)", out, re.I)
        tx = re.search(r"Transmit rate \(Mbps\)\s*:\s*([\d.]+)", out, re.I)
        if state:
            info["connected"] = state.group(1).strip().lower() == "connected"
        if signal:
            info["signal"] = int(signal.group(1))
        if ssid:
            info["ssid"] = ssid.group(1).strip()
        if rx:
            info["rxMbps"] = float(rx.group(1))
        if tx:
            info["txMbps"] = float(tx.group(1))
    elif system == "linux":
        try:
            with open("/proc/net/wireless") as f:
                lines = f.readlines()[2:]
            if lines:
                link = float(lines[0].split()[2].rstrip("."))
                info["signal"] = max(0, min(100, int(link / 70 * 100)))
                info["connected"] = True
        except Exception:
            pass
        name = run(["iwgetid", "-r"]).strip()
        if name:
            info["ssid"] = name
    elif system == "darwin":
        out = run(["/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-I"])
        ssid = re.search(r"^\s*SSID:\s*(.+)$", out, re.M)
        rssi = re.search(r"agrCtlRSSI:\s*(-?\d+)", out)
        rate = re.search(r"lastTxRate:\s*(\d+)", out)
        if ssid:
            info["ssid"] = ssid.group(1).strip()
            info["connected"] = True
        if rssi:
            info["signal"] = max(0, min(100, 2 * (int(rssi.group(1)) + 100)))
        if rate:
            info["txMbps"] = float(rate.group(1))
    return info


def ping_ms(system):
    cmd = ["ping", "-n", "1", "-w", "800", "1.1.1.1"] if system == "windows" else ["ping", "-c", "1", "-W", "1", "1.1.1.1"]
    out = run(cmd, timeout=1.5)
    match = re.search(r"time[=<]\s*([\d.]+)\s*ms", out, re.I)
    return round(float(match.group(1))) if match else None


def grade(sig, lat, connected):
    if sig is None and lat is None:
        return None, None
    if connected is False or (sig is not None and sig < 30) or (lat is not None and lat > 200):
        return "weak", 1
    if (sig is not None and sig < 65) or (lat is not None and lat > 80):
        return "moderate", 2
    return "strong", 3


def main():
    system = platform.system().lower()
    stats = wifi(system)
    stats["latencyMs"] = ping_ms(system)
    stats["quality"], stats["bars"] = grade(stats["signal"], stats["latencyMs"], stats["connected"])
    stats["hostname"] = socket.gethostname() or None
    stats["localIp"] = lan_ip()
    sys.stdout.write(json.dumps(stats))


if __name__ == "__main__":
    main()
