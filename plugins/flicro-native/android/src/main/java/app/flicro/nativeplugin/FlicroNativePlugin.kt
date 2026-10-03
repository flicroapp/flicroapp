package app.flicro.nativeplugin

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.NetworkInfo
import android.net.Uri
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.provider.DocumentsContract
import android.util.Base64
import androidx.core.content.ContextCompat
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import androidx.activity.result.ActivityResult
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

private const val PORT = 47474
private const val SERVICE = "_flicro._tcp."

@CapacitorPlugin(
    name = "FlicroNative",
    permissions = [
        Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION], alias = "location"),
        Permission(strings = [Manifest.permission.NEARBY_WIFI_DEVICES], alias = "nearby"),
    ],
)
class FlicroNativePlugin : Plugin() {
    private val io = Executors.newCachedThreadPool()
    private var deviceName = "Android"
    private var nsd: NsdManager? = null
    private var wifi: WifiP2pManager? = null
    private var channel: WifiP2pManager.Channel? = null
    private var receiver: BroadcastReceiver? = null
    private var server: ServerSocket? = null
    private val peers = LinkedHashMap<String, Peer>()
    private val paused = AtomicBoolean(false)
    private val cancelled = AtomicBoolean(false)
    private var accept: ((Boolean) -> Unit)? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null

    data class Peer(val id: String, val name: String, val transport: String, val host: String, val port: Int)

    data class Item(val uri: String, val name: String, val size: Long, val mime: String)

    @PluginMethod
    fun startDiscovery(call: PluginCall) {
        deviceName = call.getString("name") ?: "Android"
        if (!hasScanPermission()) {
            if (Build.VERSION.SDK_INT >= 33) {
                requestPermissionForAliases(arrayOf("location", "nearby"), call, "onPerms")
            } else {
                requestPermissionForAlias("location", call, "onPerms")
            }
            return
        }
        begin(call)
    }

    @PermissionCallback
    private fun onPerms(call: PluginCall) {
        if (!hasScanPermission()) {
            call.reject("Nearby permission was not granted.")
            return
        }
        begin(call)
    }

    private fun hasScanPermission(): Boolean {
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (Build.VERSION.SDK_INT < 33) return fine
        val nearby = getPermissionState("nearby") == PermissionState.GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.NEARBY_WIFI_DEVICES) == PackageManager.PERMISSION_GRANTED
        return fine || nearby
    }

    private fun begin(call: PluginCall) {
        startServer()
        startNsd()
        startWifiDirect()
        call.resolve()
    }

    @PluginMethod
    fun stopDiscovery(call: PluginCall) {
        stopAll()
        call.resolve()
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val id = call.getString("peerId") ?: return call.reject("Missing peer.")
        val address = id.removePrefix("p2p:")
        val manager = wifi ?: return call.reject("Wi-Fi Direct is not available on this phone.")
        val ch = channel ?: return call.reject("Wi-Fi Direct is not available on this phone.")
        val config = WifiP2pConfig()
        config.deviceAddress = address
        manager.connect(ch, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {
                call.resolve()
            }
            override fun onFailure(reason: Int) {
                call.reject("Wi-Fi Direct connect failed ($reason).")
            }
        })
    }

    @PluginMethod
    fun pickFiles(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "onPick")
    }

    @PluginMethod
    fun pickDocuments(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "onPick")
    }

    @PluginMethod
    fun pickFolder(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }
        startActivityForResult(call, intent, "onFolder")
    }

    @ActivityCallback
    private fun onPick(call: PluginCall, result: ActivityResult) {
        val data = result.data
        if (data == null) {
            call.resolve(JSObject().put("files", JSArray()))
            return
        }
        val items = ArrayList<Item>()
        val clip = data.clipData
        if (clip != null) {
            for (i in 0 until clip.itemCount) {
                persist(clip.getItemAt(i).uri)?.let { items.add(describe(it)) }
            }
        } else {
            data.data?.let { uri -> persist(uri)?.let { items.add(describe(it)) } }
        }
        call.resolve(filesObject(items))
    }

    @ActivityCallback
    private fun onFolder(call: PluginCall, result: ActivityResult) {
        val tree = result.data?.data
        if (tree == null) {
            call.resolve(JSObject().put("files", JSArray()))
            return
        }
        persist(tree)
        val items = ArrayList<Item>()
        walkTree(tree, items)
        call.resolve(filesObject(items))
    }

    @PluginMethod
    fun send(call: PluginCall) {
        val peerId = call.getString("peerId") ?: return call.reject("Missing device.")
        val peer = peers[peerId] ?: return call.reject("That device is no longer nearby.")
        if (peer.transport == "wifi-direct" && peer.host.contains(":")) {
            return call.reject("Wi-Fi Direct group is still forming. Tap the phone again in a moment.")
        }
        val list = call.getArray("files") ?: return call.reject("Choose files first.")
        val items = ArrayList<Item>()
        for (i in 0 until list.length()) {
            val obj = list.getJSONObject(i)
            items.add(Item(obj.getString("uri"), obj.getString("name"), obj.optLong("size"), obj.optString("mime", "application/octet-stream")))
        }
        if (items.isEmpty()) return call.reject("Choose files first.")
        cancelled.set(false)
        paused.set(false)
        io.execute {
            try {
                streamTo(peer, items)
                notifyDone(peer.id, true, "")
            } catch (err: Exception) {
                if (!cancelled.get()) notifyDone(peer.id, false, err.message ?: "Transfer failed.")
            }
        }
        call.resolve()
    }

    @PluginMethod
    fun accept(call: PluginCall) {
        accept?.invoke(true)
        accept = null
        call.resolve()
    }

    @PluginMethod
    fun decline(call: PluginCall) {
        accept?.invoke(false)
        accept = null
        call.resolve()
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        paused.set(true)
        call.resolve()
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        paused.set(false)
        call.resolve()
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        cancelled.set(true)
        paused.set(false)
        accept?.invoke(false)
        accept = null
        call.resolve()
    }

    private fun startServer() {
        if (server != null) return
        io.execute {
            try {
                val socket = ServerSocket(PORT)
                server = socket
                while (!socket.isClosed) {
                    val client = socket.accept()
                    io.execute { readOffer(client) }
                }
            } catch (_: Exception) {
            }
        }
    }

    private fun startNsd() {
        val manager = context.getSystemService(Context.NSD_SERVICE) as NsdManager
        nsd = manager
        val info = NsdServiceInfo()
        info.serviceName = deviceName
        info.serviceType = SERVICE
        info.port = PORT
        val registration = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(service: NsdServiceInfo) {}
            override fun onRegistrationFailed(service: NsdServiceInfo, error: Int) {}
            override fun onServiceUnregistered(service: NsdServiceInfo) {}
            override fun onUnregistrationFailed(service: NsdServiceInfo, error: Int) {}
        }
        registrationListener = registration
        manager.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration)
        val discovery = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(type: String) {}
            override fun onStartDiscoveryFailed(type: String, error: Int) {}
            override fun onDiscoveryStopped(type: String) {}
            override fun onStopDiscoveryFailed(type: String, error: Int) {}
            override fun onServiceFound(service: NsdServiceInfo) {
                if (service.serviceName == deviceName) return
                manager.resolveService(service, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(svc: NsdServiceInfo, error: Int) {}
                    override fun onServiceResolved(resolved: NsdServiceInfo) {
                        val host = resolved.host?.hostAddress ?: return
                        val peer = Peer("lan:$host:${resolved.port}", resolved.serviceName, "lan", host, resolved.port)
                        peers[peer.id] = peer
                        emitPeers()
                    }
                })
            }
            override fun onServiceLost(service: NsdServiceInfo) {
                val gone = peers.filterValues { it.name == service.serviceName && it.transport == "lan" }.keys
                gone.forEach { peers.remove(it) }
                emitPeers()
            }
        }
        discoveryListener = discovery
        manager.discoverServices(SERVICE, NsdManager.PROTOCOL_DNS_SD, discovery)
    }

    private fun startWifiDirect() {
        val manager = context.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager ?: return
        val ch = manager.initialize(context, context.mainLooper, null) ?: return
        wifi = manager
        channel = ch
        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
        }
        val rx = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                when (intent.action) {
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        manager.requestPeers(ch) { list ->
                            list.deviceList.forEach { device ->
                                val peer = Peer("p2p:${device.deviceAddress}", device.deviceName.ifBlank { "Android" }, "wifi-direct", device.deviceAddress, PORT)
                                peers[peer.id] = peer
                            }
                            emitPeers()
                        }
                    }
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        val info = if (Build.VERSION.SDK_INT >= 33) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO, WifiP2pInfo::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_INFO)
                        }
                        val network = if (Build.VERSION.SDK_INT >= 33) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO, NetworkInfo::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO)
                        }
                        if (network?.isConnected == true && info != null && !info.isGroupOwner) {
                            val host = info.groupOwnerAddress?.hostAddress ?: return
                            rememberDirect(host)
                        } else if (network?.isConnected == true && info != null && info.isGroupOwner) {
                            io.execute { watchGroupOwnerClients() }
                        }
                    }
                }
            }
        }
        receiver = rx
        if (Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(rx, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(rx, filter)
        }
        manager.discoverPeers(ch, object : WifiP2pManager.ActionListener {
            override fun onSuccess() {}
            override fun onFailure(reason: Int) {}
        })
    }

    private fun streamTo(peer: Peer, items: List<Item>) {
        val socket = Socket()
        socket.connect(InetSocketAddress(peer.host, peer.port), 8000)
        socket.soTimeout = 0
        socket.use { sock ->
            val out = sock.getOutputStream()
            val input = sock.getInputStream()
            writeHeader(out, items)
            val answer = readLine(input)
            if (answer != "ACCEPT") throw IllegalStateException(if (answer == "DECLINE") "They declined." else "They did not answer.")
            var sentAll = 0L
            val total = items.sumOf { it.size }
            items.forEachIndexed { index, item ->
                context.contentResolver.openInputStream(Uri.parse(item.uri)).use { stream ->
                    if (stream == null) throw IllegalStateException("Could not read ${item.name}.")
                    val buf = ByteArray(65536)
                    var left = item.size
                    while (left > 0) {
                        if (cancelled.get()) throw IllegalStateException("Cancelled.")
                        while (paused.get() && !cancelled.get()) Thread.sleep(80)
                        val n = stream.read(buf, 0, minOf(buf.size.toLong(), left).toInt())
                        if (n < 0) break
                        out.write(buf, 0, n)
                        left -= n
                        sentAll += n
                        notifyProgress(peer.id, item.name, sentAll, total, index, items.size)
                    }
                }
            }
            out.flush()
        }
    }

    private fun readOffer(socket: Socket) {
        socket.use { sock ->
            val input = sock.getInputStream()
            val out = sock.getOutputStream()
            val items = ArrayList<Item>()
            var from = "Device"
            while (true) {
                val line = readLine(input)
                if (line.isEmpty()) continue
                if (line == "end") break
                if (line.startsWith("name ")) from = line.removePrefix("name ")
                if (line.startsWith("file ")) {
                    val parts = line.removePrefix("file ").split(" ")
                    if (parts.size >= 3) {
                        val size = parts[0].toLongOrNull() ?: 0L
                        val name = String(Base64.decode(parts[1], Base64.NO_WRAP), Charsets.UTF_8)
                        val mime = parts[2]
                        items.add(Item("", name, size, mime))
                    }
                }
            }
            val payload = JSObject()
            payload.put("peerId", "incoming")
            payload.put("name", from)
            payload.put("files", filesObject(items).getJSONArray("files"))
            notifyListeners("offer", payload)
            val gate = java.util.concurrent.CompletableFuture<Boolean>()
            accept = { gate.complete(it) }
            val ok = try {
                gate.get(90, java.util.concurrent.TimeUnit.SECONDS)
            } catch (_: Exception) {
                false
            }
            if (!ok || cancelled.get()) {
                out.write("DECLINE\n".toByteArray())
                out.flush()
                return
            }
            out.write("ACCEPT\n".toByteArray())
            out.flush()
            val dir = File(context.getExternalFilesDir(null), "received")
            dir.mkdirs()
            var gotAll = 0L
            val total = items.sumOf { it.size }
            items.forEachIndexed { index, item ->
                val safe = item.name.replace(Regex("[\\\\/]+"), "_").ifBlank { "file" }
                val dest = File(dir, "${System.currentTimeMillis()}-$safe")
                FileOutputStream(dest).use { fileOut ->
                    var left = item.size
                    val buf = ByteArray(65536)
                    while (left > 0) {
                        if (cancelled.get()) return
                        while (paused.get() && !cancelled.get()) Thread.sleep(80)
                        val n = input.read(buf, 0, minOf(buf.size.toLong(), left).toInt())
                        if (n < 0) break
                        fileOut.write(buf, 0, n)
                        left -= n
                        gotAll += n
                        notifyProgress("incoming", item.name, gotAll, total, index, items.size)
                    }
                }
            }
            notifyDone("incoming", true, dir.absolutePath)
        }
    }

    private fun writeHeader(out: OutputStream, items: List<Item>) {
        val text = buildString {
            append("FLICRO 1\n")
            append("name ").append(deviceName.replace("\n", " ")).append('\n')
            append("count ").append(items.size).append('\n')
            items.forEach { item ->
                val b64 = Base64.encodeToString(item.name.toByteArray(), Base64.NO_WRAP)
                append("file ").append(item.size).append(' ').append(b64).append(' ').append(item.mime.replace(" ", "")).append('\n')
            }
            append("end\n")
        }
        out.write(text.toByteArray(Charsets.UTF_8))
        out.flush()
    }

    private fun readLine(input: InputStream): String {
        val buf = ByteArrayOutputStream()
        while (true) {
            val b = input.read()
            if (b < 0 || b == '\n'.code) break
            if (b != '\r'.code) buf.write(b)
        }
        return buf.toString(Charsets.UTF_8.name())
    }

    private fun rememberDirect(host: String) {
        peers.keys.filter { key -> key.startsWith("p2p:") && peers[key]?.host?.contains(":") == true }.forEach { peers.remove(it) }
        val peer = Peer("p2p:$host", "Wi-Fi Direct", "wifi-direct", host, PORT)
        peers[peer.id] = peer
        emitPeers()
    }

    private fun watchGroupOwnerClients() {
        repeat(10) {
            val ip = p2pClientAddress()
            if (ip != null) {
                rememberDirect(ip)
                return
            }
            try {
                Thread.sleep(400)
            } catch (_: InterruptedException) {
                return
            }
        }
    }

    private fun p2pClientAddress(): String? {
        val text = try {
            File("/proc/net/arp").readText()
        } catch (_: Exception) {
            return null
        }
        for (line in text.lineSequence().drop(1)) {
            val parts = line.trim().split(Regex("\\s+"))
            if (parts.size < 6) continue
            val ip = parts[0]
            val mac = parts[3]
            val iface = parts[5]
            if (mac == "00:00:00:00:00:00") continue
            if (iface.startsWith("p2p") && ip.isNotBlank()) return ip
        }
        return null
    }

    private fun persist(uri: Uri): Uri? {
        try {
            context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: Exception) {
        }
        return uri
    }

    private fun describe(uri: Uri): Item {
        var name = "file"
        var size = 0L
        var mime = context.contentResolver.getType(uri) ?: "application/octet-stream"
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                val sizeIdx = cursor.getColumnIndex(android.provider.OpenableColumns.SIZE)
                if (nameIdx >= 0) name = cursor.getString(nameIdx) ?: name
                if (sizeIdx >= 0) size = cursor.getLong(sizeIdx)
            }
        }
        return Item(uri.toString(), name, size, mime)
    }

    private fun walkTree(tree: Uri, into: MutableList<Item>) {
        val root = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val stack = ArrayDeque<Uri>()
        stack.add(root)
        while (stack.isNotEmpty()) {
            val uri = stack.removeFirst()
            context.contentResolver.query(uri, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME, DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE), null, null, null)?.use { cursor ->
                while (cursor.moveToNext()) {
                    val id = cursor.getString(0)
                    val name = cursor.getString(1) ?: "file"
                    val mime = cursor.getString(2) ?: "application/octet-stream"
                    val size = cursor.getLong(3)
                    val doc = DocumentsContract.buildDocumentUriUsingTree(tree, id)
                    if (mime == DocumentsContract.Document.MIME_TYPE_DIR) {
                        stack.add(DocumentsContract.buildChildDocumentsUriUsingTree(tree, id))
                    } else {
                        into.add(Item(doc.toString(), name, size, mime))
                    }
                }
            }
        }
    }

    private fun filesObject(items: List<Item>): JSObject {
        val arr = JSArray()
        items.forEach { item ->
            val obj = JSObject()
            obj.put("uri", item.uri)
            obj.put("name", item.name)
            obj.put("size", item.size)
            obj.put("mime", item.mime)
            arr.put(obj)
        }
        return JSObject().put("files", arr)
    }

    private fun emitPeers() {
        val arr = JSArray()
        peers.values.forEach { peer ->
            val obj = JSObject()
            obj.put("id", peer.id)
            obj.put("name", peer.name)
            obj.put("transport", peer.transport)
            arr.put(obj)
        }
        val payload = JSObject()
        payload.put("peers", arr)
        notifyListeners("peers", payload)
    }

    private fun notifyProgress(peerId: String, name: String, bytes: Long, total: Long, index: Int, count: Int) {
        val obj = JSObject()
        obj.put("peerId", peerId)
        obj.put("name", name)
        obj.put("bytes", bytes)
        obj.put("total", total)
        obj.put("fileIndex", index)
        obj.put("fileCount", count)
        notifyListeners("progress", obj)
    }

    private fun notifyDone(peerId: String, ok: Boolean, message: String) {
        val obj = JSObject()
        obj.put("peerId", peerId)
        obj.put("ok", ok)
        obj.put("message", message)
        notifyListeners("done", obj)
    }

    private fun stopAll() {
        try {
            receiver?.let { context.unregisterReceiver(it) }
        } catch (_: Exception) {
        }
        receiver = null
        try {
            server?.close()
        } catch (_: Exception) {
        }
        server = null
        val manager = nsd
        if (manager != null) {
            try {
                discoveryListener?.let { manager.stopServiceDiscovery(it) }
            } catch (_: Exception) {
            }
            try {
                registrationListener?.let { manager.unregisterService(it) }
            } catch (_: Exception) {
            }
        }
        wifi?.let { w -> channel?.let { ch -> w.stopPeerDiscovery(ch, null) } }
    }

    override fun handleOnDestroy() {
        stopAll()
        io.shutdownNow()
        super.handleOnDestroy()
    }
}
