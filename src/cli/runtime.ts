export interface NodeRuntimeVersions {
  node?: string
}

export function assertNodeRuntime(
  versions: NodeRuntimeVersions = process.versions,
): void {
  if (!versions.node) {
    throw new Error('The treebranch CLI requires a Node.js runtime.')
  }
}
