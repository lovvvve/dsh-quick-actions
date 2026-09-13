/**
 * The release surface as a contract: what the manifest declares, what the bundle
 * patch mounts, and what the tarball actually carries.
 *
 * These are packaging invariants, not smoke tests. Every one of them has a
 * failure mode that only surfaces after a release: a second generation of
 * JavaScript riding along in the tarball, a `require` the browser module table
 * cannot answer, or a patch that mounts a package name nobody publishes.
 *
 * `pnpm pack` runs here for real, because the published file list is a product
 * of `files`, the build and pnpm's own always-include rules together — none of
 * which can be checked by reading `package.json` alone. It packs a staged copy
 * of the workspace rather than the working tree: packing runs `prepack`, which
 * deletes and rebuilds `lib/`, and the working tree's `lib/` is the bundle a
 * running DSH GUI loads and the one `pnpm watch:client` republishes. Packing in
 * place would take an installed plugin offline on every failed run and race the
 * watcher on every concurrent one. The copy keeps the workspace layout verbatim,
 * so the contract loses no coverage; `packing isolation` below pins that the
 * working tree is untouched and that the copy really built what was packed.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { inject as clientInject } from '../../src/client/index.js'
import {
  featureDir,
  manifest,
  outputFingerprint,
  repoRoot,
  sourceModules,
  stageWorkspace,
  type Manifest,
  type StagedWorkspace,
} from './support.js'

const feature = manifest(featureDir)

/**
 * The repository the plugin market lists this plugin under, as the curated catalog
 * spells it (`data/plugins/lovvvve__dsh-quick-actions--packages-composer-quick-actions.yml`).
 * The published manifest has to name it, or the catalog cannot tell that the npm
 * package and the listed repository are the same thing.
 */
const LISTED_REPO = 'lovvvve/dsh-quick-actions'

/** Read one declared string list, so a malformed manifest fails as a bad manifest. */
function stringList(value: unknown, subject: string): readonly string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${subject} must be declared as a list of strings`)
  }
  return value as readonly string[]
}

const declaredExternals = stringList(feature.dsh?.client?.external, 'dsh.client.external')
const declaredInjects = stringList(feature.dsh?.client?.inject, 'dsh.client.inject')

/**
 * The browser module table's platform seeds, read out of the shipped web shell
 * of DSH 0.1.5-rc.1 (`@deepseek-ai/dsh-web-frontend`, the seed factory the boot
 * path hands to `ModuleLoader.create` as `staticModules`). A `require` for
 * anything else has to be answered by another plugin row, which is why an
 * external outside this set is a release defect rather than a runtime detail.
 *
 * The table grows between DSH releases — 0.1.5-rc.1 added `dockkit` — so it has
 * to be re-read from the shell whenever the peer floor moves, not relabelled.
 */
const BROWSER_SEEDS: readonly string[] = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/**
 * Which package's Client half provides each Cordis service this Client injects,
 * each re-read from that package's shipped `lib/client.js` at 0.1.5-rc.1.
 * `dsh.client.inject` names packages, not
 * services, so this map is what turns the Client's own `inject` list into the
 * manifest declaration the module loader orders arrivals by.
 */
const SERVICE_PROVIDERS: Readonly<Record<string, string>> = {
  slots: '@deepseek-ai/dsh-client-ui-renderer',
  settingsScope: '@deepseek-ai/dsh-client-ui-settings',
  connection: '@deepseek-ai/dsh-client-connection',
  locale: '@deepseek-ai/dsh-client-locale',
}

/**
 * The one provider that is not reachable through the Client's `inject` list:
 * `conversation` is read with `ctx.get`, deliberately without the inject
 * requirement, so nothing in `src/` names its package. The manifest still has to
 * declare it, which is exactly why it is pinned here by hand.
 */
const CTX_GET_PROVIDERS: readonly string[] = ['@deepseek-ai/dsh-client-ui-conversation']

/** One packed tarball, extracted so both its manifest and its file list can be read. */
interface Packed {
  readonly entries: readonly string[]
  readonly manifest: Manifest
  readonly root: string
}

function pack(packageDir: string, into: string): Packed {
  const listing = execFileSync('pnpm', ['pack', '--pack-destination', into], {
    cwd: packageDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const tarball = listing
    .split('\n')
    .map((line) => line.trim())
    .findLast((line) => line.endsWith('.tgz'))
  if (tarball === undefined) throw new Error(`pnpm pack printed no tarball path for ${packageDir}`)
  const root = mkdtempSync(join(into, 'extract-'))
  execFileSync('tar', ['-xzf', tarball, '-C', root])
  const entries = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('/'))
    .map((line) => line.replace(/^package\//, ''))
    .sort()
  return { entries, manifest: manifest(join(root, 'package')), root: join(root, 'package') }
}

/**
 * The working tree's build output, fingerprinted before this spec stages or
 * packs anything, so `packing isolation` can compare against it.
 */
const libBefore = outputFingerprint(join(featureDir, 'lib'))

let scratch: string
let staged: StagedWorkspace
let stagedLibAtCopy: Readonly<Record<string, string>> | null
let packedFeature: Packed

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'quick-actions-pack-'))
  staged = stageWorkspace(scratch)
  stagedLibAtCopy = outputFingerprint(join(staged.featureDir, 'lib'))
  const tarballs = join(scratch, 'tarballs')
  mkdirSync(tarballs)
  packedFeature = pack(staged.featureDir, tarballs)
}, 300_000)

afterAll(() => {
  if (scratch !== undefined) rmSync(scratch, { recursive: true, force: true })
})

describe('packing isolation', () => {
  /**
   * `prepack` runs `pnpm run build`, which deletes `lib/` before rebuilding it —
   * right in a copy, destructive in the working tree: a run that fails between
   * the two halves leaves no bundle for an installed plugin to load, and a
   * concurrent `pnpm watch:client` publishes into the directory being deleted.
   * The fingerprint covers timestamps as well as bytes, because a rebuild that
   * lands identical content still went through that window.
   */
  it('leaves the working tree build output byte- and mtime-identical', () => {
    expect(outputFingerprint(join(featureDir, 'lib'))).toStrictEqual(libBefore)
  })

  /** A copy is only isolation if it lives outside the repository. */
  it('stages the copy outside the repository', () => {
    expect(relative(repoRoot, staged.root).startsWith('..')).toBe(true)
  })

  /**
   * And it only carries the release contract if `prepack` really built there.
   * The copy is staged without build output, so every packed artifact below is
   * output this run produced in the copy — not a stale one copied in.
   */
  it('packs artifacts the copy built, from a copy that was staged with none', () => {
    expect(stagedLibAtCopy).toBeNull()
    expect(existsSync(join(staged.featureDir, 'lib/client.js'))).toBe(true)
  })
})

describe('release identity', () => {
  it('publishes the name and license the release decisions settled on', () => {
    // Ticket 20 chose the shape, ticket 27 shortened the name before the first publish
    // (spec 19), and ticket 28 folded the second package back in (spec 20) — so there is
    // exactly one published name to hold.
    expect(feature.name).toBe('dsh-quick-actions')
    expect(feature.license).toBe('MIT')
  })

  it('carries a version this release line can publish', () => {
    // Ticket 20 fixed `0.1.0` as the initial version and ticket 27 publishes a
    // `0.1.0-rc.N` ahead of it, to prove the one-command install from the registry
    // before the number that README documents is spent — an npm version can never be
    // republished with different content. Anything outside that line is a mistake.
    expect(feature.version).toMatch(/^0\.1\.0(-rc\.\d+)?$/)
  })

  it('declares no publishConfig, because unscoped packages are public by default', () => {
    expect(feature.publishConfig).toBeUndefined()
  })

  it('points the published manifest back at the repository the market lists', () => {
    // Ticket 30: the plugin market resolves an entry to an npm install only when the
    // curated catalog has linked the package to the listed repository, and it links
    // them by reading THIS field off the registry manifest of `dist-tags.latest`
    // (`awesome-dsh-plugin/scripts/probe-npm.mjs`: `repoField.includes(repo)`). The
    // first publish carried no `repository`, the link never formed, and the catalog
    // fell back to `github:lovvvve/dsh-quick-actions#path:/packages/composer-quick-actions`
    // — a source install this repository cannot satisfy, because `lib/` is a build
    // output and a devDependency is `workspace:*`. So every market install died in
    // pnpm's blocked git-prepare. The field is a release contract, not metadata.
    const repository = feature.repository
    if (typeof repository !== 'object' || repository === null) {
      throw new Error('the feature manifest declares no repository object')
    }
    const { url, directory } = repository as { url?: unknown; directory?: unknown }
    expect(typeof url === 'string' && url.includes(LISTED_REPO)).toBe(true)
    // The listing is a monorepo subpath entry, so the manifest has to say which one.
    expect(directory).toBe(relative(repoRoot, featureDir))
    // The tarball is what the registry serves and what the probe reads back.
    expect(packedFeature.manifest.repository).toEqual(repository)
  })

  it('ships the MIT text, carried in from the workspace root by pnpm', () => {
    expect(packedFeature.entries).toContain('LICENSE')
    expect(readFileSync(join(packedFeature.root, 'LICENSE'), 'utf8')).toContain('MIT License')
  })
})

describe('feature package export surface', () => {
  it('exposes the plugin contract and nothing else', () => {
    expect(Object.keys(feature.exports ?? {}).sort()).toStrictEqual([
      '.',
      './client',
      './package.json',
      './types',
    ])
  })

  it('resolves every export to a file the tarball carries', () => {
    for (const [subpath, target] of Object.entries(feature.exports ?? {})) {
      const paths =
        typeof target === 'string' ? [target] : Object.values(target as Record<string, string>)
      for (const path of paths) {
        expect(packedFeature.entries, `${subpath} -> ${path}`).toContain(path.replace(/^\.\//, ''))
      }
    }
  })

  it('keeps no Remote entry, because the catalog travels as a Settings base layer', () => {
    expect(Object.keys(feature.exports ?? {})).not.toContain('./remote')
    expect(packedFeature.entries.filter((entry) => entry.includes('remote'))).toStrictEqual([])
  })
})

describe('dsh.client declaration', () => {
  it('declares the web platform', () => {
    expect(feature.dsh?.client?.platform).toBe('web')
  })

  it('names every provider package the Client depends on, and only those', () => {
    const injected = [...clientInject].map((service) => {
      const provider = SERVICE_PROVIDERS[service]
      if (provider === undefined) throw new Error(`no known provider package for service "${service}"`)
      return provider
    })
    expect([...declaredInjects].sort()).toStrictEqual([...injected, ...CTX_GET_PROVIDERS].sort())
  })

  it('declares exactly the specifiers the shipped Client bundle requires', () => {
    const source = readFileSync(join(packedFeature.root, 'lib/client.js'), 'utf8')
    const required = [...source.matchAll(/require\("((?:[^"\\]|\\.)*)"\)/g)]
      .map((match) => match[1] as string)
      .sort()
    expect([...new Set(required)]).toStrictEqual([...declaredExternals].sort())
  })

  it('requires only modules the browser module table seeds', () => {
    for (const specifier of declaredExternals) {
      expect(BROWSER_SEEDS, specifier).toContain(specifier)
    }
  })
})

describe('bundle patch', () => {
  // Ticket 28: one package carries the patch, both halves and the implementation, the way
  // every other third-party DSH plugin does. The row therefore names this very package —
  // a patch that named anything else would mount something nobody publishes.
  it('mounts this package itself under a stable entry id', () => {
    const patch = parseYaml(readFileSync(join(featureDir, 'cordis.patch.yml'), 'utf8')) as unknown
    expect(patch).toStrictEqual([{ insert: [{ id: 'composer-quick-actions', name: feature.name }] }])
  })

  it('points dsh.bundle.patch at the packed patch file', () => {
    expect(feature.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(packedFeature.entries).toContain('cordis.patch.yml')
  })

  // The loader entry id is a different identity axis from the package name and does not
  // follow it (spec 19): it is what a later layer's `disabled` expression targets.
  it('keeps the entry id even though the package is named differently', () => {
    const patch = parseYaml(readFileSync(join(featureDir, 'cordis.patch.yml'), 'utf8')) as {
      readonly insert: readonly { readonly id: string }[]
    }[]
    expect(patch[0]?.insert[0]?.id).toBe('composer-quick-actions')
    expect(feature.name).not.toBe('composer-quick-actions')
  })

  it('needs no second package, so one tarball is the whole install', () => {
    expect(packedFeature.entries.filter((entry) => entry.startsWith('node_modules/'))).toStrictEqual([])
    expect(packedFeature.entries.filter((entry) => entry.endsWith('.tgz'))).toStrictEqual([])
    expect(feature.dependencies ?? {}).toStrictEqual({})
  })
})

describe('packed file list', () => {
  it('ships one generation of JavaScript: the two bundled entries and nothing else', () => {
    expect(packedFeature.entries.filter((entry) => entry.endsWith('.js')).sort()).toStrictEqual([
      'lib/client.js',
      'lib/index.js',
      'lib/types.js',
    ])
  })

  it('ships the Client sourcemap and no other map', () => {
    expect(packedFeature.entries.filter((entry) => entry.endsWith('.map'))).toStrictEqual([
      'lib/client.js.map',
    ])
  })

  it('ships declarations only under lib/types', () => {
    const underTypes = packedFeature.entries.filter((entry) => entry.startsWith('lib/types/'))
    expect(underTypes.length).toBeGreaterThan(0)
    expect(underTypes.filter((entry) => !entry.endsWith('.d.ts'))).toStrictEqual([])
  })

  /**
   * `tsc -b` never prunes output it no longer has a source for, so a deleted or
   * renamed module leaves its `.d.ts` behind and `files` happily ships the
   * orphan. Deriving the expected set from `src/` is what turns that into a
   * failure instead of a stale declaration riding along in the tarball.
   */
  it('ships one declaration per source module and no orphans', () => {
    const sources = sourceModules(join(featureDir, 'src'))
      .map((path) => `lib/types/${path.replace(/\.tsx?$/, '.d.ts')}`)
      .sort()
    const shipped = packedFeature.entries.filter((entry) => entry.startsWith('lib/types/')).sort()
    expect(shipped).toStrictEqual(sources)
  })

  it('ships no build metadata and no sources', () => {
    expect(packedFeature.entries.filter((entry) => entry.startsWith('src/'))).toStrictEqual([])
    expect(packedFeature.entries.filter((entry) => entry.endsWith('.tsbuildinfo'))).toStrictEqual([])
  })

  it('ships both readmes', () => {
    expect(packedFeature.entries).toContain('README.md')
    expect(packedFeature.entries).toContain('README.en.md')
  })
})

describe('peer range', () => {
  it('covers the DSH contracts the Host consumes', () => {
    const peers = feature.peerDependencies ?? {}
    expect(Object.keys(peers)).toEqual(
      expect.arrayContaining([
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/schemastery',
      ]),
    )
  })

  it('covers the DSH contracts the Client consumes', () => {
    const peers = feature.peerDependencies ?? {}
    expect(Object.keys(peers)).toEqual(
      expect.arrayContaining([...Object.values(SERVICE_PROVIDERS), ...CTX_GET_PROVIDERS, 'react']),
    )
  })

  it('declares every module-table external it requires, so resolution can warn about a missing one', () => {
    // A `dsh.client.external` is a `require` the browser module table has to
    // answer at plugin load. Declaring it as a peer is what makes an install
    // against a shell that seeds a different build fail at resolution time
    // rather than at load time with an unresolvable specifier. `react` is
    // already covered above; subpaths like `react/jsx-runtime` resolve through
    // their own package, so only whole DSH packages are checked here.
    const peers = Object.keys(feature.peerDependencies ?? {})
    for (const external of declaredExternals) {
      if (!external.startsWith('@deepseek-ai/')) continue
      expect(peers, external).toContain(external)
    }
  })

  it('leaves every DSH range open above the verified baseline, naming no first supported release', () => {
    const peers = feature.peerDependencies ?? {}
    for (const [name, range] of Object.entries(peers)) {
      if (!name.startsWith('@deepseek-ai/dsh-')) continue
      expect(range, name).toBe('>=0.1.5-rc.1')
    }
  })
})
