/**
 * A controlled stand-in for the DSH settings transport the Client controller
 * binds to: `ctx.settingsScope` over one shared describe mirror, plus
 * `ctx.connection`'s observable state.
 *
 * It reproduces the behaviours the controller actually depends on, taken from
 * `@deepseek-ai/dsh-client-ui-settings` 0.1.2-rc.1: one document read shared by
 * every bound namespace, a snapshot carrying the resolved value alongside the
 * composition `base` and the raw `user` section, revision-fenced writes that
 * fold their answer back in, and a recovery read after a refused write.
 */
import type {
  BoundSettingsScope,
  ConnectionLike,
  ConnectionState,
  SettingsMirrorSnapshot,
  SettingsScopeService,
  SettingsScopeSnapshot,
  SettingsScopeSpec,
  SettingsSetOp,
} from '../../src/client/controller.js'

/** One registered namespace as the Host would describe it. */
export interface FakeNamespace {
  /** Schema defaults, the bottom layer of the resolved value. */
  readonly defaults?: Record<string, unknown>
  /** Composition base layer, where the read-only catalog rides (spec 17.2). */
  base?: unknown
  /** Raw stored user section. */
  user?: Record<string, unknown>
  revision: number
}

/** Why the fake Host refused the next write. */
export type FakeWriteRefusal = 'rejected' | 'throw'

function clone<T>(value: T): T {
  return structuredClone(value)
}

/**
 * The shared settings document plus the mirror over it. Tests drive the Host
 * side through this object; the controller only ever sees the scope service.
 */
export class FakeSettingsDocument {
  writable = true
  mode: 'host' | 'memory' = 'host'
  /** Whether a `settings.describe` read has ever answered; false models a read still in flight. */
  answered = true
  /** The last read's failure, as the mirror reports it; set to model a failed read. */
  readError: string | null = null
  /** Set to make the next document read fail rather than answer. */
  failReads = false
  /** Set to make an explicit `load()` reject, the way a failed read does. */
  loadRejects = false
  /** Reads that crossed the wire, so a test can pin the catalog's zero-RPC budget. */
  describeReads = 0
  /** Writes that crossed the wire, so a test can pin that an unchanged plan writes nothing. */
  writes = 0
  /** Namespaces a controller bound, in bind order. */
  readonly bound: string[] = []
  /** Set to refuse the next write, the way a read-only or racing Host would. */
  refuseWrites: FakeWriteRefusal | undefined
  /** Runs inside a write, after it reached the Host and before the fence is checked. */
  onWrite: (() => void) | undefined
  readonly namespaces = new Map<string, FakeNamespace>()
  private readonly listeners = new Set<() => void>()

  register(ns: string, namespace: Omit<FakeNamespace, 'revision'> & { revision?: number }): void {
    this.namespaces.set(ns, { revision: 0, ...namespace })
    this.publish()
  }

  /** Answer the first (or a later) describe read, the way a reconnect refreshes the mirror. */
  answer(): void {
    this.describeReads += 1
    if (this.failReads) {
      this.readError = 'fake settings document read failed'
      this.publish()
      return
    }
    this.answered = true
    this.readError = null
    this.publish()
  }

  /** The shared document as the mirror holds it. */
  mirrorSnapshot(): SettingsMirrorSnapshot {
    return {
      ...(this.answered ? { view: { namespaces: [...this.namespaces.keys()] } } : {}),
      error: this.readError,
    }
  }

  /** A concurrent writer moving the namespace on, so the next fenced write loses. */
  concurrentWrite(ns: string, section: Record<string, unknown>): void {
    const namespace = this.require(ns)
    namespace.user = clone(section)
    namespace.revision += 1
    this.publish()
  }

  /** The raw stored user section, as a test asserts persistence. */
  stored(ns: string): Record<string, unknown> | undefined {
    return this.namespaces.get(ns)?.user
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Live listener count, so a test can prove a disposed controller leaks nothing. */
  get listenerCount(): number {
    return this.listeners.size
  }

  snapshot(spec: SettingsScopeSpec): SettingsScopeSnapshot {
    if (this.mode === 'memory') {
      return { status: 'unavailable', writable: false, mode: 'memory' }
    }
    if (!this.answered) return { status: 'loading', writable: false, mode: 'host' }
    const namespace = this.namespaces.get(spec.namespace)
    if (namespace === undefined) return { status: 'unavailable', writable: this.writable, mode: 'host' }

    const resolved = { ...namespace.defaults, ...asRecord(namespace.base), ...namespace.user }
    const decoded = spec.decode === undefined ? resolved : spec.decode(clone(resolved))
    return {
      status: decoded === undefined ? 'loading' : 'ready',
      ...(decoded === undefined ? {} : { value: decoded }),
      ...(namespace.base === undefined ? {} : { base: clone(namespace.base) }),
      revision: namespace.revision,
      writable: this.writable,
      mode: 'host',
    }
  }

  async mutate(ns: string, ops: readonly SettingsSetOp[], expectedRevision: number | undefined): Promise<void> {
    this.writes += 1
    await Promise.resolve()
    this.onWrite?.()
    const namespace = this.require(ns)
    const refusal = this.refuseWrites
    if (refusal === 'throw') throw new Error('fake settings transport failed')
    if (refusal === 'rejected' || !this.writable) {
      this.recover()
      return
    }
    if (expectedRevision !== undefined && expectedRevision !== namespace.revision) {
      this.recover()
      return
    }

    const user: Record<string, unknown> = { ...namespace.user }
    for (const op of ops) {
      const [field] = op.path
      if (field === undefined) throw new Error('fake settings transport: the empty path is not exercised')
      user[field] = clone(op.value)
    }
    namespace.user = user
    namespace.revision += 1
    this.publish()
  }

  /** The one recovery read a refused or failed latest write triggers. */
  private recover(): void {
    this.describeReads += 1
    this.publish()
  }

  private require(ns: string): FakeNamespace {
    const namespace = this.namespaces.get(ns)
    if (namespace === undefined) throw new Error(`fake settings transport: ${ns} is not registered`)
    return namespace
  }

  private publish(): void {
    for (const listener of Array.from(this.listeners)) listener()
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/** The `ctx.settingsScope` face over one fake document. */
export function fakeSettingsScope(document: FakeSettingsDocument): SettingsScopeService {
  return {
    bind(spec: SettingsScopeSpec): BoundSettingsScope {
      document.bound.push(spec.namespace)
      return {
        getSnapshot: () => document.snapshot(spec),
        subscribe: (listener) => document.subscribe(listener),
        mutate: (ops, expectedRevision) => document.mutate(spec.namespace, ops, expectedRevision),
      }
    },
    describe: () => ({
      getSnapshot: () => document.mirrorSnapshot(),
      subscribe: (listener) => document.subscribe(listener),
      load: async () => {
        document.answer()
        if (document.loadRejects) throw new Error('fake settings document read failed')
      },
    }),
  }
}

/** The `ctx.connection` face, driven by the test. */
export class FakeConnection implements ConnectionLike {
  private current: ConnectionState = 'connected'
  private readonly listeners = new Set<() => void>()

  readonly state = {
    getSnapshot: (): ConnectionState => this.current,
    subscribe: (listener: () => void): (() => void) => {
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    },
  }

  set(next: ConnectionState): void {
    this.current = next
    for (const listener of Array.from(this.listeners)) listener()
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}
