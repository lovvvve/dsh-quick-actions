/** Shared fixtures for the release specs: the two package directories and their manifests. */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** The dual-face feature package. */
export const featureDir = resolve(here, '../..')

/** The install bundle that mounts it. */
export const bundleDir = resolve(featureDir, '../composer-quick-actions-bundle')

/** Only the manifest fields the release contract asserts on. */
export interface Manifest {
  readonly name?: unknown
  readonly version?: unknown
  readonly license?: unknown
  readonly publishConfig?: unknown
  readonly files?: unknown
  readonly exports?: Record<string, unknown>
  readonly dependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly dsh?: {
    readonly client?: { readonly platform?: unknown; readonly inject?: unknown; readonly external?: unknown }
    readonly bundle?: { readonly patch?: unknown }
  }
}

/** Read one package manifest from a package root. */
export function manifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
}

/**
 * The released version, read from the feature manifest so a version bump lands in
 * one place. Both packages release together, which the identity spec pins.
 */
export function releasedVersion(): string {
  const version = manifest(featureDir).version
  if (typeof version !== 'string') throw new Error('the feature manifest declares no version')
  return version
}

/**
 * Every TypeScript module under `dir`, as paths relative to it. Used to derive
 * the declarations a build owes, so orphaned output is detectable.
 */
export function sourceModules(dir: string, prefix = ''): readonly string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...sourceModules(join(dir, entry.name), relative))
    else if (/\.tsx?$/.test(entry.name)) found.push(relative)
  }
  return found
}
