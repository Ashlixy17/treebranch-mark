export interface LocalGitSourceInput {
  repositoryPath: string
  branch?: string
  options?: LocalGitSourceOptions
}

export interface LocalGitSourceOptions {
  maxCommitsPerBranch?: number
}
