<?php
/**
 * PHP network monitor helper script.
 * Can be executed via `php scripts/network_monitor.php`.
 */
function get_wifi_stats_php() {
    $stats = [
        "connected" => false,
        "signal" => 0,
        "quality" => "weak",
        "bars" => 1,
        "ssid" => "Wi-Fi",
        "latencyMs" => null,
        "rxMbps" => null,
        "txMbps" => null,
    ];

    if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
        @exec('netsh wlan show interfaces', $output);
        $text = implode("\n", $output);
        if (preg_match('/State\s*:\s*(.+)/i', $text, $m)) {
            $stats["connected"] = (stripos($m[1], 'connected') !== false);
        }
        if (preg_match('/Signal\s*:\s*(\d+)%/i', $text, $m)) {
            $stats["signal"] = (int)$m[1];
        }
        if (preg_match('/SSID\s*:\s*(.+)/i', $text, $m)) {
            $stats["ssid"] = trim($m[1]);
        }
        if (preg_match('/Receive rate\s*\(Mbps\)\s*:\s*([\d.]+)/i', $text, $m)) {
            $stats["rxMbps"] = (float)$m[1];
        }
        if (preg_match('/Transmit rate\s*\(Mbps\)\s*:\s*([\d.]+)/i', $text, $m)) {
            $stats["txMbps"] = (float)$m[1];
        }
    } else {
        $stats["connected"] = true;
        $stats["signal"] = 75;
        $stats["ssid"] = "Local Wi-Fi";
    }

    // Ping check
    @exec('ping -n 1 -w 500 1.1.1.1', $pingOut);
    $pingText = implode("\n", $pingOut);
    if (preg_match('/time[=<]\s*(\d+)\s*ms/i', $pingText, $m)) {
        $stats["latencyMs"] = (int)$m[1];
    }

    $sig = $stats["signal"];
    $lat = $stats["latencyMs"];
    if (!$stats["connected"] || $sig < 30 || ($lat !== null && $lat > 200)) {
        $stats["quality"] = "weak";
        $stats["bars"] = 1;
    } elseif ($sig < 65 || ($lat !== null && $lat > 80)) {
        $stats["quality"] = "moderate";
        $stats["bars"] = 2;
    } else {
        $stats["quality"] = "strong";
        $stats["bars"] = 3;
    }

    return $stats;
}

echo json_encode(get_wifi_stats_php());
