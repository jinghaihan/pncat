// ported from: https://github.com/unjs/pkg-types/blob/main/src/packagejson/types.ts

export interface PackageJson {
  /**
   * The name is what your thing is called.
   * Some rules:
   * - The name must be less than or equal to 214 characters. This includes the scope for scoped packages.
   * - The name can’t start with a dot or an underscore.
   * - New packages must not have uppercase letters in the name.
   * - The name ends up being part of a URL, an argument on the command line, and a folder name. Therefore, the name can’t contain any non-URL-safe characters.
   */
  name?: string

  /**
   * Version must be parseable by `node-semver`, which is bundled with npm as a dependency. (`npm install semver` to use it yourself.)
   */
  version?: string

  /**
   * Put a description in it. It’s a string. This helps people discover your package, as it’s listed in `npm search`.
   */
  description?: string

  /**
   * Dependencies are specified in a simple object that maps a package name to a version range. The version range is a string which has one or more space-separated descriptors. Dependencies can also be identified with a tarball or git URL.
   */
  dependencies?: Record<string, string>

  /**
   * If someone is planning on downloading and using your module in their program, then they probably don’t want or need to download and build the external test or documentation framework that you use.
   * In this case, it’s best to map these additional items in a `devDependencies` object.
   */
  devDependencies?: Record<string, string>

  /**
   * If a dependency can be used, but you would like npm to proceed if it cannot be found or fails to install, then you may put it in the `optionalDependencies` object. This is a map of package name to version or url, just like the `dependencies` object. The difference is that build failures do not cause installation to fail.
   */
  optionalDependencies?: Record<string, string>

  /**
   * In some cases, you want to express the compatibility of your package with a host tool or library, while not necessarily doing a `require` of this host. This is usually referred to as a plugin. Notably, your module may be exposing a specific interface, expected and specified by the host documentation.
   */
  peerDependencies?: Record<string, string>

  /**
   * The field is used to define a set of sub-packages (or workspaces) within a monorepo.
   *
   * This field is an array of glob patterns or an object with specific configurations for managing
   * multiple packages in a single repository.
   */
  workspaces?:
    | string[]
    | {
      /**
       * Workspace package paths. Glob patterns are supported.
       */
      packages?: string[]

      /**
       * Packages to block from hoisting to the workspace root.
       * Uses glob patterns to match module paths in the dependency tree.
       *
       * Docs:
       * - https://classic.yarnpkg.com/blog/2018/02/15/nohoist/
       */
      nohoist?: string[]

      /**
       * Docs:
       * - https://bun.sh/docs/install/catalogs
       */
      catalog?: Record<string, string>
      catalogs?: Record<string, Record<string, string>>
    }

  /**
   *  Docs:
   * - https://code.visualstudio.com/api/references/extension-manifest
   */
  engines?: {
    vscode?: string
  }

  [key: string]: any
}
