/** Shared fixtures for the release specs: the two package directories and their manifests. */
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'

const here = dirname(fileURLToPath(import.meta.url))

/** The dual-face feature package. */
export const featureDir = resolve(here, '../..')

/** The install bundle that mounts it. */
export const bundleDir = resolve(featureDir, '../composer-quick-actions-bundle')

/** The workspace root that owns both packages and the Client build adapter. */
export const repoRoot = resolve(featureDir, '../..')

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

/** Every file under `dir`, as paths relative to it. */
function walk(dir: string, prefix = ''): readonly string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) found.push(...walk(join(dir, entry.name), path))
    else found.push(path)
  }
  return found
}

/**
 * Every TypeScript module under `dir`, as paths relative to it. Used to derive
 * the declarations a build owes, so orphaned output is detectable.
 */
export function sourceModules(dir: string): readonly string[] {
  return walk(dir).filter((path) => /\.tsx?$/.test(path))
}

/**
 * Every file under `dir` as `size:mtimeMs:sha256`, or `null` when `dir` does not
 * exist. Both content and timestamp are in the fingerprint because the
 * regression to catch is a build that deletes a directory and rewrites the same
 * bytes into it — identical content, a new file, and a window in between where
 * a DSH GUI loading that directory finds nothing.
 */
export function outputFingerprint(dir: string): Readonly<Record<string, string>> | null {
  if (!existsSync(dir)) return null
  const fingerprint: Record<string, string> = {}
  for (const path of walk(dir)) {
    const full = join(dir, path)
    const stats = statSync(full)
    const digest = createHash('sha256').update(readFileSync(full)).digest('hex')
    fingerprint[path] = `${stats.size}:${stats.mtimeMs}:${digest}`
  }
  return fingerprint
}

/** Build output and installed dependencies: linked or derived, never copied. */
const DERIVED_ENTRIES: readonly string[] = ['node_modules', 'lib', 'lib.dsh-client-stage']

/**
 * The workspace-root files a staged copy needs before any package in it can
 * build and pack. `pnpm-workspace.yaml` is what makes the copy a workspace at
 * all: it is how `workspace:*` dependencies resolve to versions at pack time and
 * how the root `LICENSE` reaches each tarball.
 */
const ROOT_FILES: readonly string[] = ['package.json', 'pnpm-workspace.yaml', 'LICENSE', 'tsconfig.base.json']

/**
 * Every workspace package directory, relative to the root, read out of
 * `pnpm-workspace.yaml` so a package added to the workspace joins a staged copy
 * without an edit here. Only `<dir>/*` globs occur in this workspace; anything
 * else fails loudly rather than staging a workspace that is quietly incomplete.
 */
function workspacePackageDirs(): readonly string[] {
  const declared = (parseYaml(readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')) as { packages?: unknown })
    .packages
  if (!Array.isArray(declared) || declared.some((glob) => typeof glob !== 'string')) {
    throw new Error('pnpm-workspace.yaml must declare `packages` as a list of strings')
  }
  const dirs: string[] = []
  for (const glob of declared as readonly string[]) {
    const segments = glob.split('/')
    if (segments.length !== 2 || segments[1] !== '*') {
      throw new Error(`unsupported workspace glob "${glob}": a staged copy only resolves "<dir>/*"`)
    }
    const parent = segments[0] as string
    for (const entry of readdirSync(join(repoRoot, parent), { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(repoRoot, parent, entry.name, 'package.json'))) {
        dirs.push(`${parent}/${entry.name}`)
      }
    }
  }
  return dirs
}

/** One throwaway copy of the workspace, with both package directories located in it. */
export interface StagedWorkspace {
  readonly root: string
  readonly featureDir: string
  readonly bundleDir: string
}

/**
 * Copy the workspace into `into` so packing — and the real `prepack` build that
 * packing runs — writes its output there instead of into the working tree.
 *
 * The copy keeps the workspace layout verbatim, which is what preserves the
 * release contract's coverage: the same `files` globs against the same package
 * directory, under the same workspace root. Two things are not copied. Build
 * output is left out so anything the copy carries afterwards is this run's own
 * `prepack` output. Installed dependencies are symlinked to where they already
 * live, so the copy needs no install: pnpm's own links inside `node_modules` are
 * resolved through their real paths, which is also how `tsdown` reaches the
 * unpublished Client build adapter and how `tsc` and `tsdown` themselves are
 * found on `PATH`.
 */
export function stageWorkspace(into: string): StagedWorkspace {
  const root = join(into, 'staged')
  mkdirSync(root, { recursive: true })
  for (const file of ROOT_FILES) cpSync(join(repoRoot, file), join(root, file))
  const packageDirs = workspacePackageDirs()
  for (const dir of packageDirs) {
    cpSync(join(repoRoot, dir), join(root, dir), {
      recursive: true,
      filter: (source) => !DERIVED_ENTRIES.includes(basename(source)),
    })
  }
  for (const dir of ['', ...packageDirs]) {
    const installed = join(repoRoot, dir, 'node_modules')
    if (existsSync(installed)) symlinkSync(installed, join(root, dir, 'node_modules'), 'dir')
  }
  return {
    root,
    featureDir: join(root, relative(repoRoot, featureDir)),
    bundleDir: join(root, relative(repoRoot, bundleDir)),
  }
}
