import { registerPlugin } from "@capacitor/core";
import type { FlicroNativePlugin } from "./definitions";

export type { NativeFile, NativePeer, FlicroNativePlugin } from "./definitions";

export const FlicroNative = registerPlugin<FlicroNativePlugin>("FlicroNative", {
  web: () => import("./web").then((m) => new m.FlicroNativeWeb()),
});
