import { registerPlugin } from "@capacitor/core";
import type { NativeFile, NativePeer, FlicroNativePlugin } from "../../../plugins/flicro-native/src/definitions";

export type { NativeFile, NativePeer };

export const FlicroNative = registerPlugin<FlicroNativePlugin>("FlicroNative", {
  web: () => import("../../../plugins/flicro-native/src/web").then((m) => new m.FlicroNativeWeb()),
});
