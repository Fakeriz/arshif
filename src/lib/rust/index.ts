import { fromBase64 } from '../base64';
import { WASM_BASE64, WASM_BYTE_LENGTH } from './wasmArtifact';

export type RustBackendKind = 'native' | 'wasm' | 'ts-fallback';
export type RustCoreMode = 'auto' | 'wasm' | 'ts-fallback';
export type RustCoreStatus = {
  activeBackend: RustBackendKind;
  wasmReady: boolean;
  wasmBytes: number;
};

export type RustBackupErrorCode = 'not_backup' | 'version' | 'bad_key' | 'corrupt';

type NativeRustCoreModule = {
  version?: () => number;
  sealBackup?: (key: Uint8Array, headerBytes: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array) => Uint8Array;
  readBackupHeaderBounds?: (file: Uint8Array) => { offset: number; length: number };
  openBackup?: (key: Uint8Array, file: Uint8Array) => Uint8Array;
  formatRecoveryKey?: (key: Uint8Array) => string;
  parseRecoveryKey?: (input: string) => Uint8Array | null;
  rateToScaledStr?: (rate: string) => string;
  crossRate?: (fromRate: string, toRate: string) => string;
  convertMinor?: (minor: number, fromExp: number, toExp: number, rate: string) => number;
  convertMajorFixed10?: (fixed10: string, isNegative: boolean, toExp: number, rate: string) => number;
  parseAmountInput?: (text: string, exponent: number) => number | null;
  similarity?: (a: string, b: string) => number;
  reconcileBalances?: (
    baseBalance: number,
    closingBalance: number,
    deltas: number[],
  ) => { projectedBalance: number; difference: number } | null;
  parseSmartlogAmount?: (raw: string, exponent: number) => number | null;
  cyrb53Hash?: (input: string) => string;
};

type WasmExports = {
  memory: WebAssembly.Memory;
  arshif_version: () => number;
  arshif_alloc: (len: number) => number;
  arshif_dealloc: (ptr: number, len: number) => void;
  arshif_seal_backup: (
    keyPtr: number,
    keyLen: number,
    headerPtr: number,
    headerLen: number,
    noncePtr: number,
    nonceLen: number,
    plainPtr: number,
    plainLen: number,
    outPtrPtr: number,
    outLenPtr: number,
  ) => number;
  arshif_read_backup_header: (
    filePtr: number,
    fileLen: number,
    outOffsetPtr: number,
    outLenPtr: number,
  ) => number;
  arshif_open_backup: (
    keyPtr: number,
    keyLen: number,
    filePtr: number,
    fileLen: number,
    outPtrPtr: number,
    outLenPtr: number,
  ) => number;
  arshif_format_recovery_key: (
    keyPtr: number,
    keyLen: number,
    outPtrPtr: number,
    outLenPtr: number,
  ) => number;
  arshif_parse_recovery_key: (strPtr: number, strLen: number, outKey32Ptr: number) => number;
  arshif_rate_to_scaled_str: (
    ratePtr: number,
    rateLen: number,
    outPtrPtr: number,
    outLenPtr: number,
  ) => number;
  arshif_cross_rate: (
    fromPtr: number,
    fromLen: number,
    toPtr: number,
    toLen: number,
    outPtrPtr: number,
    outLenPtr: number,
  ) => number;
  arshif_convert_minor: (
    minorF64: number,
    fromExp: number,
    toExp: number,
    ratePtr: number,
    rateLen: number,
    outF64Ptr: number,
  ) => number;
  arshif_convert_major_fixed10: (
    fixed10Ptr: number,
    fixed10Len: number,
    isNegative: number,
    toExp: number,
    ratePtr: number,
    rateLen: number,
    outF64Ptr: number,
  ) => number;
  arshif_parse_amount_input: (
    textPtr: number,
    textLen: number,
    exponent: number,
    outF64Ptr: number,
  ) => number;
  arshif_similarity: (aPtr: number, aLen: number, bPtr: number, bLen: number) => number;
  arshif_reconcile_balances: (
    baseF64: number,
    closingF64: number,
    deltasPtr: number,
    deltasLen: number,
    outProjectedPtr: number,
    outDiffPtr: number,
  ) => number;
  arshif_parse_smartlog_amount: (
    rawPtr: number,
    rawLen: number,
    exponent: number,
    outF64Ptr: number,
  ) => number;
  arshif_cyrb53_hash: (strPtr: number, strLen: number, outHex16Ptr: number) => number;
};

type WasmRuntime = {
  exports: WasmExports;
  scratchPtr: number;
};

const STATUS_OK = 0;
const STATUS_NOT_BACKUP = 1;
const STATUS_VERSION = 2;
const STATUS_BAD_KEY = 3;
const STATUS_CORRUPT = 4;
const STATUS_INVALID_INPUT = 10;
const STATUS_OUT_OF_SAFE_RANGE = 12;
const STATUS_ZERO_DENOMINATOR = 13;
const STATUS_UNSAFE_MINOR = 14;

const SCRATCH_OUT_PTR = 0;
const SCRATCH_OUT_LEN = 4;
const SCRATCH_F64_A = 8;
const SCRATCH_F64_B = 16;
const SCRATCH_BYTES_32 = 24;
const SCRATCH_SIZE = 64;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let testMode: RustCoreMode = 'auto';
let nativeChecked = false;
let nativeModule: NativeRustCoreModule | null = null;
let wasmRuntime: WasmRuntime | null = null;
let wasmInitPromise: Promise<void> | null = null;
let wasmInitAttempted = false;

function detectNativeModule(): NativeRustCoreModule | null {
  if (nativeChecked) return nativeModule;
  nativeChecked = true;
  try {
    const g = globalThis as { expo?: { modules?: { ArshifRustCore?: NativeRustCoreModule } } };
    const expoMod = g.expo?.modules?.ArshifRustCore;
    if (expoMod && typeof expoMod === 'object') {
      nativeModule = expoMod;
      return nativeModule;
    }
    if (typeof document === 'undefined' && typeof require === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rn = require('react-native') as { TurboModuleRegistry?: { get?: (name: string) => unknown } } | undefined;
      const turbo = rn?.TurboModuleRegistry?.get?.('ArshifRustCore');
      if (turbo && typeof turbo === 'object') {
        nativeModule = turbo as NativeRustCoreModule;
        return nativeModule;
      }
    }
  } catch {
    nativeModule = null;
  }
  return nativeModule;
}

function attachWasmInstance(instance: WebAssembly.Instance): WasmRuntime | null {
  const exports = instance.exports as unknown as WasmExports;
  if (typeof exports.arshif_version !== 'function' || exports.arshif_version() !== 1) {
    return null;
  }
  const scratchPtr = exports.arshif_alloc(SCRATCH_SIZE);
  if (!scratchPtr) return null;
  return { exports, scratchPtr };
}

function decodeWasmBuffer(): ArrayBuffer {
  const decoded = fromBase64(WASM_BASE64);
  const exact = new Uint8Array(decoded.byteLength);
  exact.set(decoded);
  return exact.buffer;
}

function initWasmIfPossible(): void {
  if (wasmInitAttempted || wasmRuntime) return;
  wasmInitAttempted = true;
  if (typeof WebAssembly === 'undefined') return;

  let buffer: ArrayBuffer;
  try {
    buffer = decodeWasmBuffer();
  } catch {
    return;
  }

  const canCompileSync = typeof document === 'undefined' || buffer.byteLength <= 4096;
  if (canCompileSync) {
    try {
      const mod = new WebAssembly.Module(buffer);
      const inst = new WebAssembly.Instance(mod, {});
      const rt = attachWasmInstance(inst);
      if (rt) {
        wasmRuntime = rt;
        return;
      }
    } catch {
      // Fall through to async instantiation if sync compilation is disallowed in this environment.
    }
  }

  if (typeof WebAssembly.instantiate === 'function') {
    wasmInitPromise = WebAssembly.instantiate(buffer, {})
      .then((res) => {
        const inst = 'instance' in res ? res.instance : (res as unknown as WebAssembly.Instance);
        const rt = attachWasmInstance(inst);
        if (rt) wasmRuntime = rt;
      })
      .catch(() => {
        // Keep TS fallback active when WASM instantiation is unavailable.
      });
  }
}

initWasmIfPossible();

function resolveActiveBackend(): RustBackendKind {
  if (testMode === 'ts-fallback') return 'ts-fallback';
  if (testMode === 'wasm') return wasmRuntime ? 'wasm' : 'ts-fallback';
  if (detectNativeModule()) return 'native';
  if (wasmRuntime) return 'wasm';
  return 'ts-fallback';
}

function getNativeIfEnabled(): NativeRustCoreModule | null {
  if (testMode !== 'auto') return null;
  return detectNativeModule();
}

function getWasmIfEnabled(): WasmRuntime | null {
  if (testMode === 'ts-fallback') return null;
  if (!wasmRuntime && !wasmInitAttempted) initWasmIfPossible();
  return wasmRuntime;
}

export function getRustCoreStatus(): RustCoreStatus {
  return {
    activeBackend: resolveActiveBackend(),
    wasmReady: wasmRuntime !== null,
    wasmBytes: WASM_BYTE_LENGTH,
  };
}

export async function ensureRustCoreReady(): Promise<RustBackendKind> {
  if (testMode === 'ts-fallback') return 'ts-fallback';
  if (testMode === 'auto' && detectNativeModule()) return 'native';
  if (!wasmRuntime && !wasmInitAttempted) initWasmIfPossible();
  if (wasmInitPromise) {
    await wasmInitPromise;
  }
  return resolveActiveBackend();
}

export function setRustCoreModeForTests(mode: RustCoreMode): void {
  testMode = mode;
}

class WasmAllocError extends Error {
  constructor() {
    super('wasm_alloc_failed');
  }
}

function writeBytesToWasm(rt: WasmRuntime, data: Uint8Array, tracked: { ptr: number; len: number }[]): { ptr: number; len: number } {
  const len = data.byteLength;
  const ptr = rt.exports.arshif_alloc(len);
  if (len > 0 && !ptr) throw new WasmAllocError();
  tracked.push({ ptr, len });
  if (len > 0) {
    new Uint8Array(rt.exports.memory.buffer, ptr, len).set(data);
  }
  return { ptr, len };
}

function writeStringToWasm(rt: WasmRuntime, str: string, tracked: { ptr: number; len: number }[]): { ptr: number; len: number } {
  return writeBytesToWasm(rt, textEncoder.encode(str), tracked);
}

function freeTracked(rt: WasmRuntime, tracked: { ptr: number; len: number }[]): void {
  for (let i = tracked.length - 1; i >= 0; i--) {
    const b = tracked[i]!;
    rt.exports.arshif_dealloc(b.ptr, b.len);
  }
}

function readAndFreeOutBytes(rt: WasmRuntime): Uint8Array {
  const dv = new DataView(rt.exports.memory.buffer);
  const outPtr = dv.getUint32(rt.scratchPtr + SCRATCH_OUT_PTR, true);
  const outLen = dv.getUint32(rt.scratchPtr + SCRATCH_OUT_LEN, true);
  try {
    const copy = new Uint8Array(outLen);
    if (outLen > 0) {
      copy.set(new Uint8Array(rt.exports.memory.buffer, outPtr, outLen));
    }
    return copy;
  } finally {
    rt.exports.arshif_dealloc(outPtr, outLen);
  }
}

function statusToBackupCode(rc: number): RustBackupErrorCode {
  switch (rc) {
    case STATUS_NOT_BACKUP:
      return 'not_backup';
    case STATUS_VERSION:
      return 'version';
    case STATUS_BAD_KEY:
      return 'bad_key';
    case STATUS_CORRUPT:
    default:
      return 'corrupt';
  }
}

export function rustSealBackup(
  key: Uint8Array,
  headerBytes: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
): { ok: true; data: Uint8Array } | { ok: false; code: RustBackupErrorCode } | null {
  const native = getNativeIfEnabled();
  if (native?.sealBackup) {
    return { ok: true, data: native.sealBackup(key, headerBytes, nonce, plaintext) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return null;

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const kBuf = writeBytesToWasm(rt, key, tracked);
    const hBuf = writeBytesToWasm(rt, headerBytes, tracked);
    const nBuf = writeBytesToWasm(rt, nonce, tracked);
    const pBuf = writeBytesToWasm(rt, plaintext, tracked);
    const rc = rt.exports.arshif_seal_backup(
      kBuf.ptr,
      kBuf.len,
      hBuf.ptr,
      hBuf.len,
      nBuf.ptr,
      nBuf.len,
      pBuf.ptr,
      pBuf.len,
      rt.scratchPtr + SCRATCH_OUT_PTR,
      rt.scratchPtr + SCRATCH_OUT_LEN,
    );
    if (rc !== STATUS_OK) {
      return { ok: false, code: statusToBackupCode(rc) };
    }
    return { ok: true, data: readAndFreeOutBytes(rt) };
  } catch (e) {
    if (e instanceof WasmAllocError) return null;
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustReadBackupHeaderBounds(
  file: Uint8Array,
): { ok: true; offset: number; length: number } | { ok: false; code: RustBackupErrorCode } | null {
  const native = getNativeIfEnabled();
  if (native?.readBackupHeaderBounds) {
    const bounds = native.readBackupHeaderBounds(file);
    return { ok: true, offset: bounds.offset, length: bounds.length };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return null;

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const fBuf = writeBytesToWasm(rt, file, tracked);
    const rc = rt.exports.arshif_read_backup_header(
      fBuf.ptr,
      fBuf.len,
      rt.scratchPtr + SCRATCH_OUT_PTR,
      rt.scratchPtr + SCRATCH_OUT_LEN,
    );
    if (rc !== STATUS_OK) {
      return { ok: false, code: statusToBackupCode(rc) };
    }
    const dv = new DataView(rt.exports.memory.buffer);
    const offset = dv.getUint32(rt.scratchPtr + SCRATCH_OUT_PTR, true);
    const length = dv.getUint32(rt.scratchPtr + SCRATCH_OUT_LEN, true);
    return { ok: true, offset, length };
  } catch (e) {
    if (e instanceof WasmAllocError) return null;
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustOpenBackup(
  key: Uint8Array,
  file: Uint8Array,
): { ok: true; plaintext: Uint8Array } | { ok: false; code: RustBackupErrorCode } | null {
  const native = getNativeIfEnabled();
  if (native?.openBackup) {
    return { ok: true, plaintext: native.openBackup(key, file) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return null;

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const kBuf = writeBytesToWasm(rt, key, tracked);
    const fBuf = writeBytesToWasm(rt, file, tracked);
    const rc = rt.exports.arshif_open_backup(
      kBuf.ptr,
      kBuf.len,
      fBuf.ptr,
      fBuf.len,
      rt.scratchPtr + SCRATCH_OUT_PTR,
      rt.scratchPtr + SCRATCH_OUT_LEN,
    );
    if (rc !== STATUS_OK) {
      return { ok: false, code: statusToBackupCode(rc) };
    }
    return { ok: true, plaintext: readAndFreeOutBytes(rt) };
  } catch (e) {
    if (e instanceof WasmAllocError) return null;
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustFormatRecoveryKey(key: Uint8Array): string | null {
  const native = getNativeIfEnabled();
  if (native?.formatRecoveryKey) return native.formatRecoveryKey(key);
  const rt = getWasmIfEnabled();
  if (!rt) return null;

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const kBuf = writeBytesToWasm(rt, key, tracked);
    const rc = rt.exports.arshif_format_recovery_key(
      kBuf.ptr,
      kBuf.len,
      rt.scratchPtr + SCRATCH_OUT_PTR,
      rt.scratchPtr + SCRATCH_OUT_LEN,
    );
    if (rc !== STATUS_OK) return null;
    return textDecoder.decode(readAndFreeOutBytes(rt));
  } catch (e) {
    if (e instanceof WasmAllocError) return null;
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustParseRecoveryKey(
  input: string,
): { handled: true; value: Uint8Array | null } | { handled: false } {
  const native = getNativeIfEnabled();
  if (native?.parseRecoveryKey) {
    return { handled: true, value: native.parseRecoveryKey(input) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { handled: false };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const sBuf = writeStringToWasm(rt, input, tracked);
    const rc = rt.exports.arshif_parse_recovery_key(
      sBuf.ptr,
      sBuf.len,
      rt.scratchPtr + SCRATCH_BYTES_32,
    );
    if (rc !== STATUS_OK) {
      return { handled: true, value: null };
    }
    const key = new Uint8Array(32);
    key.set(new Uint8Array(rt.exports.memory.buffer, rt.scratchPtr + SCRATCH_BYTES_32, 32));
    return { handled: true, value: key };
  } catch (e) {
    if (e instanceof WasmAllocError) return { handled: false };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustRateToScaled(
  rate: string,
): { status: 'ok'; value: bigint } | { status: 'invalid' } | { status: 'fallback' } {
  const native = getNativeIfEnabled();
  if (native?.rateToScaledStr) {
    try {
      return { status: 'ok', value: BigInt(native.rateToScaledStr(rate)) };
    } catch {
      return { status: 'invalid' };
    }
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { status: 'fallback' };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const rBuf = writeStringToWasm(rt, rate, tracked);
    const rc = rt.exports.arshif_rate_to_scaled_str(
      rBuf.ptr,
      rBuf.len,
      rt.scratchPtr + SCRATCH_OUT_PTR,
      rt.scratchPtr + SCRATCH_OUT_LEN,
    );
    if (rc === STATUS_OK) {
      return { status: 'ok', value: BigInt(textDecoder.decode(readAndFreeOutBytes(rt))) };
    }
    if (rc === STATUS_INVALID_INPUT) return { status: 'invalid' };
    return { status: 'fallback' };
  } catch (e) {
    if (e instanceof WasmAllocError) return { status: 'fallback' };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustCrossRate(
  fromPerUsd: string,
  toPerUsd: string,
):
  | { status: 'ok'; value: string }
  | { status: 'invalid' }
  | { status: 'zero_denominator' }
  | { status: 'fallback' } {
  const native = getNativeIfEnabled();
  if (native?.crossRate) {
    return { status: 'ok', value: native.crossRate(fromPerUsd, toPerUsd) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { status: 'fallback' };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const fBuf = writeStringToWasm(rt, fromPerUsd, tracked);
    const tBuf = writeStringToWasm(rt, toPerUsd, tracked);
    const rc = rt.exports.arshif_cross_rate(
      fBuf.ptr,
      fBuf.len,
      tBuf.ptr,
      tBuf.len,
      rt.scratchPtr + SCRATCH_OUT_PTR,
      rt.scratchPtr + SCRATCH_OUT_LEN,
    );
    if (rc === STATUS_OK) {
      return { status: 'ok', value: textDecoder.decode(readAndFreeOutBytes(rt)) };
    }
    if (rc === STATUS_ZERO_DENOMINATOR) return { status: 'zero_denominator' };
    if (rc === STATUS_INVALID_INPUT) return { status: 'invalid' };
    return { status: 'fallback' };
  } catch (e) {
    if (e instanceof WasmAllocError) return { status: 'fallback' };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustConvertMinor(
  minor: number,
  fromExp: number,
  toExp: number,
  rate: string,
):
  | { status: 'ok'; value: number }
  | { status: 'unsafe_minor' }
  | { status: 'invalid_rate' }
  | { status: 'out_of_range' }
  | { status: 'fallback' } {
  const native = getNativeIfEnabled();
  if (native?.convertMinor) {
    return { status: 'ok', value: native.convertMinor(minor, fromExp, toExp, rate) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { status: 'fallback' };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const rBuf = writeStringToWasm(rt, rate, tracked);
    const rc = rt.exports.arshif_convert_minor(
      minor,
      fromExp,
      toExp,
      rBuf.ptr,
      rBuf.len,
      rt.scratchPtr + SCRATCH_F64_A,
    );
    if (rc === STATUS_OK) {
      const dv = new DataView(rt.exports.memory.buffer);
      return { status: 'ok', value: dv.getFloat64(rt.scratchPtr + SCRATCH_F64_A, true) };
    }
    if (rc === STATUS_UNSAFE_MINOR) return { status: 'unsafe_minor' };
    if (rc === STATUS_INVALID_INPUT) return { status: 'invalid_rate' };
    if (rc === STATUS_OUT_OF_SAFE_RANGE) return { status: 'out_of_range' };
    return { status: 'fallback' };
  } catch (e) {
    if (e instanceof WasmAllocError) return { status: 'fallback' };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustConvertMajorFixed10(
  fixed10: string,
  isNegative: boolean,
  toExp: number,
  rate: string,
): { status: 'ok'; value: number } | { status: 'out_of_range' } | { status: 'fallback' } {
  const native = getNativeIfEnabled();
  if (native?.convertMajorFixed10) {
    return { status: 'ok', value: native.convertMajorFixed10(fixed10, isNegative, toExp, rate) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { status: 'fallback' };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const fBuf = writeStringToWasm(rt, fixed10, tracked);
    const rBuf = writeStringToWasm(rt, rate, tracked);
    const rc = rt.exports.arshif_convert_major_fixed10(
      fBuf.ptr,
      fBuf.len,
      isNegative ? 1 : 0,
      toExp,
      rBuf.ptr,
      rBuf.len,
      rt.scratchPtr + SCRATCH_F64_A,
    );
    if (rc === STATUS_OK) {
      const dv = new DataView(rt.exports.memory.buffer);
      return { status: 'ok', value: dv.getFloat64(rt.scratchPtr + SCRATCH_F64_A, true) };
    }
    if (rc === STATUS_OUT_OF_SAFE_RANGE || rc === STATUS_INVALID_INPUT) {
      return { status: 'out_of_range' };
    }
    return { status: 'fallback' };
  } catch (e) {
    if (e instanceof WasmAllocError) return { status: 'fallback' };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustParseAmountInput(
  text: string,
  exponent: number,
): { handled: true; value: number | null } | { handled: false } {
  const native = getNativeIfEnabled();
  if (native?.parseAmountInput) {
    return { handled: true, value: native.parseAmountInput(text, exponent) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { handled: false };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const tBuf = writeStringToWasm(rt, text, tracked);
    const rc = rt.exports.arshif_parse_amount_input(
      tBuf.ptr,
      tBuf.len,
      exponent,
      rt.scratchPtr + SCRATCH_F64_A,
    );
    if (rc !== STATUS_OK) return { handled: true, value: null };
    const dv = new DataView(rt.exports.memory.buffer);
    return { handled: true, value: dv.getFloat64(rt.scratchPtr + SCRATCH_F64_A, true) };
  } catch (e) {
    if (e instanceof WasmAllocError) return { handled: false };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustSimilarity(a: string, b: string): number | null {
  const native = getNativeIfEnabled();
  if (native?.similarity) return native.similarity(a, b);
  const rt = getWasmIfEnabled();
  if (!rt) return null;

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const aBuf = writeStringToWasm(rt, a, tracked);
    const bBuf = writeStringToWasm(rt, b, tracked);
    return rt.exports.arshif_similarity(aBuf.ptr, aBuf.len, bBuf.ptr, bBuf.len);
  } catch (e) {
    if (e instanceof WasmAllocError) return null;
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustReconcileBalances(
  baseBalance: number,
  closingBalance: number,
  deltas: number[],
): { handled: true; value: { projectedBalance: number; difference: number } | null } | { handled: false } {
  const native = getNativeIfEnabled();
  if (native?.reconcileBalances) {
    return { handled: true, value: native.reconcileBalances(baseBalance, closingBalance, deltas) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { handled: false };

  const byteLen = deltas.length * 8;
  const dPtr = rt.exports.arshif_alloc(byteLen);
  if (byteLen > 0 && !dPtr) return { handled: false };
  if (deltas.length > 0) {
    const f64View = new Float64Array(rt.exports.memory.buffer, dPtr, deltas.length);
    for (let i = 0; i < deltas.length; i++) {
      f64View[i] = deltas[i]!;
    }
  }
  try {
    const rc = rt.exports.arshif_reconcile_balances(
      baseBalance,
      closingBalance,
      dPtr,
      deltas.length,
      rt.scratchPtr + SCRATCH_F64_A,
      rt.scratchPtr + SCRATCH_F64_B,
    );
    if (rc !== STATUS_OK) return { handled: true, value: null };
    const dv = new DataView(rt.exports.memory.buffer);
    return {
      handled: true,
      value: {
        projectedBalance: dv.getFloat64(rt.scratchPtr + SCRATCH_F64_A, true),
        difference: dv.getFloat64(rt.scratchPtr + SCRATCH_F64_B, true),
      },
    };
  } finally {
    rt.exports.arshif_dealloc(dPtr, byteLen);
  }
}

export function rustParseSmartlogAmount(
  raw: string,
  exponent: number,
): { handled: true; value: number | null } | { handled: false } {
  const native = getNativeIfEnabled();
  if (native?.parseSmartlogAmount) {
    return { handled: true, value: native.parseSmartlogAmount(raw, exponent) };
  }
  const rt = getWasmIfEnabled();
  if (!rt) return { handled: false };

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const rBuf = writeStringToWasm(rt, raw, tracked);
    const rc = rt.exports.arshif_parse_smartlog_amount(
      rBuf.ptr,
      rBuf.len,
      exponent,
      rt.scratchPtr + SCRATCH_F64_A,
    );
    if (rc !== STATUS_OK) return { handled: true, value: null };
    const dv = new DataView(rt.exports.memory.buffer);
    return { handled: true, value: dv.getFloat64(rt.scratchPtr + SCRATCH_F64_A, true) };
  } catch (e) {
    if (e instanceof WasmAllocError) return { handled: false };
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}

export function rustCyrb53Hash(input: string): string | null {
  const native = getNativeIfEnabled();
  if (native?.cyrb53Hash) {
    const h = native.cyrb53Hash(input);
    if (h) return h;
  }
  const rt = getWasmIfEnabled();
  if (!rt) return null;

  const tracked: { ptr: number; len: number }[] = [];
  try {
    const sBuf = writeStringToWasm(rt, input, tracked);
    const rc = rt.exports.arshif_cyrb53_hash(
      sBuf.ptr,
      sBuf.len,
      rt.scratchPtr + SCRATCH_BYTES_32,
    );
    if (rc !== STATUS_OK) return null;
    const hexBytes = new Uint8Array(16);
    hexBytes.set(new Uint8Array(rt.exports.memory.buffer, rt.scratchPtr + SCRATCH_BYTES_32, 16));
    return textDecoder.decode(hexBytes);
  } catch (e) {
    if (e instanceof WasmAllocError) return null;
    throw e;
  } finally {
    freeTracked(rt, tracked);
  }
}
