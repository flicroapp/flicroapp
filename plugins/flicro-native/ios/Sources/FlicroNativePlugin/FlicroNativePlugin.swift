import Capacitor
import Foundation
import MultipeerConnectivity
import Network
import PhotosUI
import UniformTypeIdentifiers

private let flicroPort: UInt16 = 47474

@objc(FlicroNativePlugin)
public class FlicroNativePlugin: CAPPlugin, CAPBridgedPlugin, MCSessionDelegate, MCNearbyServiceAdvertiserDelegate, MCNearbyServiceBrowserDelegate, UIDocumentPickerDelegate, PHPickerViewControllerDelegate {
    public let identifier = "FlicroNativePlugin"
    public let jsName = "FlicroNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startDiscovery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopDiscovery", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickDocuments", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "accept", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "decline", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private var deviceName = UIDevice.current.name
    private var listener: NWListener?
    private var browser: NWBrowser?
    private var endpoints: [String: NWEndpoint] = [:]
    private var mcPeer: MCPeerID?
    private var session: MCSession?
    private var advertiser: MCNearbyServiceAdvertiser?
    private var mcBrowser: MCNearbyServiceBrowser?
    private var savedCall: CAPPluginCall?
    private var acceptHandler: ((Bool) -> Void)?
    private var paused = false
    private var cancelled = false
    private var pickingFolder = false
    private var lanPeers: [[String: String]] = []
    private var mcPeers: [[String: String]] = []
    private var scoped: [URL] = []
    private var pendingMcPeer: MCPeerID?
    private var pendingMcItems: [(url: URL, name: String, size: Int64, mime: String)] = []
    private let queue = DispatchQueue(label: "app.flicro.transfer")

    @objc func startDiscovery(_ call: CAPPluginCall) {
        deviceName = call.getString("name") ?? UIDevice.current.name
        startListener()
        startBrowser()
        startMultipeer()
        call.resolve()
    }

    @objc func stopDiscovery(_ call: CAPPluginCall) {
        listener?.cancel()
        browser?.cancel()
        advertiser?.stopAdvertisingPeer()
        mcBrowser?.stopBrowsingForPeers()
        session?.disconnect()
        call.resolve()
    }

    @objc func connect(_ call: CAPPluginCall) {
        call.resolve()
    }

    @objc func pickFiles(_ call: CAPPluginCall) {
        savedCall = call
        DispatchQueue.main.async {
            var config = PHPickerConfiguration(photoLibrary: .shared())
            config.selectionLimit = 0
            config.filter = .any(of: [.images, .videos])
            let picker = PHPickerViewController(configuration: config)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    @objc func pickFolder(_ call: CAPPluginCall) {
        savedCall = call
        pickingFolder = true
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.allowsMultipleSelection = false
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    @objc func pickDocuments(_ call: CAPPluginCall) {
        savedCall = call
        pickingFolder = false
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item])
            picker.allowsMultipleSelection = true
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let peerId = call.getString("peerId") else {
            call.reject("Missing device.")
            return
        }
        guard let files = call.getArray("files", JSObject.self) else {
            call.reject("Choose files first.")
            return
        }
        let items: [(url: URL, name: String, size: Int64, mime: String)] = files.compactMap { obj in
            guard let uri = obj["uri"] as? String, let url = URL(string: uri) else { return nil }
            let name = (obj["name"] as? String) ?? url.lastPathComponent
            let size = (obj["size"] as? NSNumber)?.int64Value ?? 0
            let mime = (obj["mime"] as? String) ?? "application/octet-stream"
            return (url, name, size, mime)
        }
        if items.isEmpty {
            call.reject("Choose files first.")
            return
        }
        cancelled = false
        paused = false
        if peerId.hasPrefix("mc:"), let session, let peer = session.connectedPeers.first(where: { "mc:\($0.displayName)" == peerId }) {
            sendMultipeer(session: session, peer: peer, items: items)
        } else if let endpoint = endpoints[peerId] {
            sendLan(endpoint: endpoint, peerId: peerId, items: items)
        } else {
            call.reject("That device is no longer nearby.")
            return
        }
        call.resolve()
    }

    @objc func accept(_ call: CAPPluginCall) {
        acceptHandler?(true)
        acceptHandler = nil
        call.resolve()
    }

    @objc func decline(_ call: CAPPluginCall) {
        acceptHandler?(false)
        acceptHandler = nil
        call.resolve()
    }

    @objc func pause(_ call: CAPPluginCall) {
        paused = true
        call.resolve()
    }

    @objc func resume(_ call: CAPPluginCall) {
        paused = false
        call.resolve()
    }

    @objc func cancel(_ call: CAPPluginCall) {
        cancelled = true
        paused = false
        acceptHandler?(false)
        acceptHandler = nil
        call.resolve()
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        let call = savedCall
        savedCall = nil
        if results.isEmpty {
            call?.resolve(["files": []])
            return
        }
        let group = DispatchGroup()
        var files: [[String: Any]] = []
        let lock = NSLock()
        for result in results {
            group.enter()
            result.itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.data.identifier) { url, _ in
                defer { group.leave() }
                guard let url else { return }
                let dest = FileManager.default.temporaryDirectory.appendingPathComponent(url.lastPathComponent)
                try? FileManager.default.removeItem(at: dest)
                try? FileManager.default.copyItem(at: url, to: dest)
                let size = (try? FileManager.default.attributesOfItem(atPath: dest.path)[.size] as? NSNumber)?.int64Value ?? 0
                lock.lock()
                files.append(["uri": dest.absoluteString, "name": dest.lastPathComponent, "size": size, "mime": "application/octet-stream"])
                lock.unlock()
            }
        }
        group.notify(queue: .main) {
            call?.resolve(["files": files])
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if !pickingFolder {
            var files: [[String: Any]] = []
            for url in urls {
                if url.startAccessingSecurityScopedResource() {
                    scoped.append(url)
                }
                let values = try? url.resourceValues(forKeys: [.fileSizeKey])
                files.append([
                    "uri": url.absoluteString,
                    "name": url.lastPathComponent,
                    "size": values?.fileSize ?? 0,
                    "mime": "application/octet-stream"
                ])
            }
            savedCall?.resolve(["files": files])
            savedCall = nil
            return
        }
        guard let root = urls.first else {
            savedCall?.resolve(["files": []])
            savedCall = nil
            return
        }
        if root.startAccessingSecurityScopedResource() {
            scoped.append(root)
        }
        var files: [[String: Any]] = []
        if let enumerator = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey]) {
            for case let file as URL in enumerator {
                let values = try? file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
                if values?.isRegularFile != true { continue }
                files.append([
                    "uri": file.absoluteString,
                    "name": file.lastPathComponent,
                    "size": values?.fileSize ?? 0,
                    "mime": "application/octet-stream"
                ])
            }
        }
        savedCall?.resolve(["files": files])
        savedCall = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        savedCall?.resolve(["files": []])
        savedCall = nil
    }

    private func startListener() {
        do {
            let listener = try NWListener(using: .tcp, on: NWEndpoint.Port(rawValue: flicroPort)!)
            listener.service = NWListener.Service(name: deviceName, type: "_flicro._tcp")
            listener.newConnectionHandler = { [weak self] connection in
                self?.receiveLan(connection)
            }
            listener.start(queue: queue)
            self.listener = listener
        } catch {
            notifyListeners("done", data: ["peerId": "", "ok": false, "message": "Could not listen on the local network."])
        }
    }

    private func startBrowser() {
        let browser = NWBrowser(for: .bonjour(type: "_flicro._tcp", domain: nil), using: .tcp)
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            guard let self else { return }
            self.endpoints.removeAll()
            var found: [[String: String]] = []
            for result in results {
                if case let .service(name, _, _, _) = result.endpoint {
                    if name == self.deviceName { continue }
                    let id = "lan:\(name)"
                    self.endpoints[id] = result.endpoint
                    found.append(["id": id, "name": name, "transport": "lan"])
                }
            }
            self.lanPeers = found
            self.emitAllPeers()
        }
        browser.start(queue: queue)
        self.browser = browser
    }

    private func startMultipeer() {
        let peer = MCPeerID(displayName: deviceName)
        mcPeer = peer
        let session = MCSession(peer: peer, securityIdentity: nil, encryptionPreference: .required)
        session.delegate = self
        self.session = session
        let advertiser = MCNearbyServiceAdvertiser(peer: peer, discoveryInfo: nil, serviceType: "flicro-mc")
        advertiser.delegate = self
        advertiser.startAdvertisingPeer()
        self.advertiser = advertiser
        let browser = MCNearbyServiceBrowser(peer: peer, serviceType: "flicro-mc")
        browser.delegate = self
        browser.startBrowsingForPeers()
        self.mcBrowser = browser
    }

    private func emitAllPeers() {
        notifyListeners("peers", data: ["peers": lanPeers + mcPeers])
    }

    private func sendLan(endpoint: NWEndpoint, peerId: String, items: [(url: URL, name: String, size: Int64, mime: String)]) {
        let connection = NWConnection(to: endpoint, using: .tcp)
        connection.stateUpdateHandler = { [weak self] state in
            if case .ready = state {
                self?.writeOffer(connection: connection, peerId: peerId, items: items)
            }
        }
        connection.start(queue: queue)
    }

    private func writeOffer(connection: NWConnection, peerId: String, items: [(url: URL, name: String, size: Int64, mime: String)]) {
        var header = "FLICRO 1\nname \(deviceName)\ncount \(items.count)\n"
        for item in items {
            let b64 = Data(item.name.utf8).base64EncodedString()
            header += "file \(item.size) \(b64) \(item.mime.replacingOccurrences(of: " ", with: ""))\n"
        }
        header += "end\n"
        connection.send(content: Data(header.utf8), completion: .contentProcessed { [weak self] error in
            if error != nil {
                self?.notifyListeners("done", data: ["peerId": peerId, "ok": false, "message": "Could not reach that device."])
                return
            }
            self?.readAnswer(connection: connection, peerId: peerId, items: items)
        })
    }

    private func readAnswer(connection: NWConnection, peerId: String, items: [(url: URL, name: String, size: Int64, mime: String)]) {
        readLine(connection) { [weak self] line in
            guard let self else { return }
            if line != "ACCEPT" {
                self.notifyListeners("done", data: ["peerId": peerId, "ok": false, "message": line == "DECLINE" ? "They declined." : "They did not answer."])
                connection.cancel()
                return
            }
            self.writeFiles(connection: connection, peerId: peerId, items: items, index: 0, sent: 0, total: items.reduce(0) { $0 + $1.size })
        }
    }

    private func writeFiles(connection: NWConnection, peerId: String, items: [(url: URL, name: String, size: Int64, mime: String)], index: Int, sent: Int64, total: Int64) {
        if index >= items.count {
            notifyListeners("done", data: ["peerId": peerId, "ok": true, "message": ""])
            connection.cancel()
            return
        }
        let item = items[index]
        guard let handle = try? FileHandle(forReadingFrom: item.url) else {
            notifyListeners("done", data: ["peerId": peerId, "ok": false, "message": "Could not read \(item.name)."])
            return
        }
        sendHandle(handle, connection: connection, peerId: peerId, name: item.name, remaining: item.size, sent: sent, total: total, fileIndex: index, fileCount: items.count) { [weak self] in
            try? handle.close()
            self?.writeFiles(connection: connection, peerId: peerId, items: items, index: index + 1, sent: sent + item.size, total: total)
        }
    }

    private func sendHandle(_ handle: FileHandle, connection: NWConnection, peerId: String, name: String, remaining: Int64, sent: Int64, total: Int64, fileIndex: Int, fileCount: Int, done: @escaping () -> Void) {
        if cancelled {
            connection.cancel()
            return
        }
        if paused {
            queue.asyncAfter(deadline: .now() + 0.08) { [weak self] in
                self?.sendHandle(handle, connection: connection, peerId: peerId, name: name, remaining: remaining, sent: sent, total: total, fileIndex: fileIndex, fileCount: fileCount, done: done)
            }
            return
        }
        if remaining <= 0 {
            done()
            return
        }
        let chunk = handle.readData(ofLength: Int(min(Int64(65536), remaining)))
        if chunk.isEmpty {
            done()
            return
        }
        connection.send(content: chunk, completion: .contentProcessed { [weak self] _ in
            let nextSent = sent + Int64(chunk.count)
            self?.notifyListeners("progress", data: [
                "peerId": peerId,
                "name": name,
                "bytes": nextSent,
                "total": total,
                "fileIndex": fileIndex,
                "fileCount": fileCount
            ])
            self?.sendHandle(handle, connection: connection, peerId: peerId, name: name, remaining: remaining - Int64(chunk.count), sent: nextSent, total: total, fileIndex: fileIndex, fileCount: fileCount, done: done)
        })
    }

    private func receiveLan(_ connection: NWConnection) {
        connection.start(queue: queue)
        readHeader(connection, lines: [])
    }

    private func readHeader(_ connection: NWConnection, lines: [String]) {
        readLine(connection) { [weak self] line in
            guard let self else { return }
            if line == "end" {
                self.finishHeader(connection, lines: lines)
            } else {
                self.readHeader(connection, lines: lines + [line])
            }
        }
    }

    private func finishHeader(_ connection: NWConnection, lines: [String]) {
        var from = "Device"
        var files: [[String: Any]] = []
        for line in lines {
            if line.hasPrefix("name ") { from = String(line.dropFirst(5)) }
            if line.hasPrefix("file ") {
                let parts = line.dropFirst(5).split(separator: " ")
                if parts.count >= 3, let size = Int64(parts[0]), let data = Data(base64Encoded: String(parts[1])), let name = String(data: data, encoding: .utf8) {
                    files.append(["uri": "", "name": name, "size": size, "mime": String(parts[2])])
                }
            }
        }
        notifyListeners("offer", data: ["peerId": "incoming", "name": from, "files": files])
        acceptHandler = { [weak self] ok in
            let word = ok ? "ACCEPT\n" : "DECLINE\n"
            connection.send(content: Data(word.utf8), completion: .contentProcessed { _ in
                if ok { self?.readBodies(connection, files: files, index: 0, got: 0) }
                else { connection.cancel() }
            })
        }
    }

    private func readBodies(_ connection: NWConnection, files: [[String: Any]], index: Int, got: Int64) {
        if index >= files.count {
            notifyListeners("done", data: ["peerId": "incoming", "ok": true, "message": ""])
            connection.cancel()
            return
        }
        let name = files[index]["name"] as? String ?? "file"
        let size = (files[index]["size"] as? NSNumber)?.int64Value ?? (files[index]["size"] as? Int64 ?? 0)
        let dest = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("\(Int(Date().timeIntervalSince1970))-\(name)")
        FileManager.default.createFile(atPath: dest.path, contents: nil)
        guard let handle = try? FileHandle(forWritingTo: dest) else { return }
        readBody(connection, handle: handle, left: size, got: got, total: files.reduce(0) { $0 + (($1["size"] as? Int64) ?? 0) }, name: name, index: index, count: files.count) { [weak self] in
            try? handle.close()
            self?.readBodies(connection, files: files, index: index + 1, got: got + size)
        }
    }

    private func readBody(_ connection: NWConnection, handle: FileHandle, left: Int64, got: Int64, total: Int64, name: String, index: Int, count: Int, done: @escaping () -> Void) {
        if cancelled {
            connection.cancel()
            return
        }
        if paused {
            queue.asyncAfter(deadline: .now() + 0.08) { [weak self] in
                self?.readBody(connection, handle: handle, left: left, got: got, total: total, name: name, index: index, count: count, done: done)
            }
            return
        }
        if left <= 0 {
            done()
            return
        }
        connection.receive(minimumIncompleteLength: 1, maximumLength: Int(min(Int64(65536), left))) { [weak self] data, _, _, _ in
            guard let self, let data, !data.isEmpty else { return }
            try? handle.write(contentsOf: data)
            let next = got + Int64(data.count)
            self.notifyListeners("progress", data: ["peerId": "incoming", "name": name, "bytes": next, "total": total, "fileIndex": index, "fileCount": count])
            self.readBody(connection, handle: handle, left: left - Int64(data.count), got: next, total: total, name: name, index: index, count: count, done: done)
        }
    }

    private func readLine(_ connection: NWConnection, done: @escaping (String) -> Void) {
        var bytes = Data()
        func step() {
            connection.receive(minimumIncompleteLength: 1, maximumLength: 1) { data, _, _, _ in
                guard let data, let byte = data.first else { return }
                if byte == 10 {
                    done(String(data: bytes, encoding: .utf8) ?? "")
                } else if byte != 13 {
                    bytes.append(byte)
                    step()
                } else {
                    step()
                }
            }
        }
        step()
    }

    private func sendMultipeer(session: MCSession, peer: MCPeerID, items: [(url: URL, name: String, size: Int64, mime: String)]) {
        pendingMcPeer = peer
        pendingMcItems = items
        let meta = items.map { ["name": $0.name, "size": $0.size, "mime": $0.mime] as [String: Any] }
        guard let data = try? JSONSerialization.data(withJSONObject: ["type": "offer", "files": meta]) else { return }
        try? session.send(data, toPeers: [peer], with: .reliable)
    }

    private func startPendingMultipeerSend() {
        guard let session, let peer = pendingMcPeer else { return }
        let items = pendingMcItems
        if items.isEmpty {
            notifyListeners("done", data: ["peerId": "mc:\(peer.displayName)", "ok": false, "message": "Choose files first."])
            return
        }
        sendMc(session: session, peer: peer, items: items, index: 0)
    }

    private func sendMc(session: MCSession, peer: MCPeerID, items: [(url: URL, name: String, size: Int64, mime: String)], index: Int) {
        let peerId = "mc:\(peer.displayName)"
        if index >= items.count {
            notifyListeners("done", data: ["peerId": peerId, "ok": true, "message": ""])
            return
        }
        let item = items[index]
        let total = items.reduce(Int64(0)) { $0 + $1.size }
        let prior = items.prefix(index).reduce(Int64(0)) { $0 + $1.size }
        let progress = session.sendResource(at: item.url, withName: item.name, toPeer: peer) { [weak self] error in
            if error != nil {
                self?.notifyListeners("done", data: ["peerId": peerId, "ok": false, "message": "Could not send \(item.name)."])
                return
            }
            self?.sendMc(session: session, peer: peer, items: items, index: index + 1)
        }
        watch(progress, peerId: peerId, name: item.name, prior: prior, total: total, index: index, count: items.count)
    }

    private func watch(_ progress: Progress, peerId: String, name: String, prior: Int64, total: Int64, index: Int, count: Int) {
        notifyListeners("progress", data: [
            "peerId": peerId,
            "name": name,
            "bytes": prior + progress.completedUnitCount,
            "total": total,
            "fileIndex": index,
            "fileCount": count
        ])
        if progress.isFinished || progress.isCancelled { return }
        queue.asyncAfter(deadline: .now() + 0.3) { [weak self] in
            self?.watch(progress, peerId: peerId, name: name, prior: prior, total: total, index: index, count: count)
        }
    }

    public func session(_ session: MCSession, peer peerID: MCPeerID, didChange state: MCSessionState) {
        let id = "mc:\(peerID.displayName)"
        if state == .connected {
            if !mcPeers.contains(where: { $0["id"] == id }) {
                mcPeers.append(["id": id, "name": peerID.displayName, "transport": "multipeer"])
            }
        } else if state == .notConnected {
            mcPeers.removeAll { $0["id"] == id }
        }
        emitAllPeers()
    }

    public func session(_ session: MCSession, didReceive data: Data, fromPeer peerID: MCPeerID) {
        if let text = String(data: data, encoding: .utf8), text == "ACCEPT" {
            startPendingMultipeerSend()
            return
        }
        if let text = String(data: data, encoding: .utf8), text == "DECLINE" {
            pendingMcPeer = nil
            pendingMcItems = []
            notifyListeners("done", data: ["peerId": "mc:\(peerID.displayName)", "ok": false, "message": "They declined."])
            return
        }
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any], obj["type"] as? String == "offer" {
            notifyListeners("offer", data: ["peerId": "mc:\(peerID.displayName)", "name": peerID.displayName, "files": obj["files"] ?? []])
            acceptHandler = { ok in
                let word = ok ? "ACCEPT" : "DECLINE"
                if let answer = word.data(using: .utf8) {
                    try? session.send(answer, toPeers: [peerID], with: .reliable)
                }
            }
        }
    }

    public func session(_ session: MCSession, didReceive stream: InputStream, withName streamName: String, fromPeer peerID: MCPeerID) {}

    public func session(_ session: MCSession, didStartReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, with progress: Progress) {}

    public func session(_ session: MCSession, didFinishReceivingResourceWithName resourceName: String, fromPeer peerID: MCPeerID, at localURL: URL?, withError error: Error?) {
        guard let localURL else { return }
        let dest = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(resourceName)
        try? FileManager.default.removeItem(at: dest)
        try? FileManager.default.copyItem(at: localURL, to: dest)
        notifyListeners("done", data: ["peerId": "mc:\(peerID.displayName)", "ok": error == nil, "message": dest.path])
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser, didReceiveInvitationFromPeer peerID: MCPeerID, withContext context: Data?, invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        invitationHandler(true, session)
    }

    public func browser(_ browser: MCNearbyServiceBrowser, foundPeer peerID: MCPeerID, withDiscoveryInfo info: [String: String]?) {
        if let session {
            browser.invitePeer(peerID, to: session, withContext: nil, timeout: 20)
        }
    }

    public func browser(_ browser: MCNearbyServiceBrowser, lostPeer peerID: MCPeerID) {}
}
