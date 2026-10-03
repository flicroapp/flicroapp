export interface NativeFile {
  uri: string;
  name: string;
  size: number;
  mime: string;
}

export interface NativePeer {
  id: string;
  name: string;
  transport: "lan" | "wifi-direct" | "multipeer";
}

export interface FlicroNativePlugin {
  startDiscovery(options: { name: string }): Promise<void>;
  stopDiscovery(): Promise<void>;
  connect(options: { peerId: string }): Promise<void>;
  pickFiles(): Promise<{ files: NativeFile[] }>;
  pickFolder(): Promise<{ files: NativeFile[] }>;
  pickDocuments(): Promise<{ files: NativeFile[] }>;
  send(options: { peerId: string; files: NativeFile[] }): Promise<void>;
  accept(): Promise<void>;
  decline(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;
  addListener(event: "peers", handler: (payload: { peers: NativePeer[] }) => void): Promise<{ remove: () => void }>;
  addListener(event: "offer", handler: (payload: { peerId: string; name: string; files: NativeFile[] }) => void): Promise<{ remove: () => void }>;
  addListener(event: "progress", handler: (payload: { peerId: string; name: string; bytes: number; total: number; fileIndex: number; fileCount: number }) => void): Promise<{ remove: () => void }>;
  addListener(event: "done", handler: (payload: { peerId: string; ok: boolean; message: string }) => void): Promise<{ remove: () => void }>;
}
