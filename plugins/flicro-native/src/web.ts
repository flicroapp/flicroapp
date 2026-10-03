import { WebPlugin } from "@capacitor/core";
import type { NativeFile, FlicroNativePlugin } from "./definitions";

export class FlicroNativeWeb extends WebPlugin implements FlicroNativePlugin {
  async startDiscovery(): Promise<void> {
    throw this.unavailable("Native nearby transfer is only in the Android and iOS app.");
  }
  async stopDiscovery(): Promise<void> {
    return;
  }
  async connect(): Promise<void> {
    throw this.unavailable("Native nearby transfer is only in the Android and iOS app.");
  }
  async pickFiles(): Promise<{ files: NativeFile[] }> {
    throw this.unavailable("Native nearby transfer is only in the Android and iOS app.");
  }
  async pickFolder(): Promise<{ files: NativeFile[] }> {
    throw this.unavailable("Native nearby transfer is only in the Android and iOS app.");
  }
  async pickDocuments(): Promise<{ files: NativeFile[] }> {
    throw this.unavailable("Native nearby transfer is only in the Android and iOS app.");
  }
  async send(): Promise<void> {
    throw this.unavailable("Native nearby transfer is only in the Android and iOS app.");
  }
  async accept(): Promise<void> {
    return;
  }
  async decline(): Promise<void> {
    return;
  }
  async pause(): Promise<void> {
    return;
  }
  async resume(): Promise<void> {
    return;
  }
  async cancel(): Promise<void> {
    return;
  }
}
