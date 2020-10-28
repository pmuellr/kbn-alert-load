export interface CliArguments {
  command: string
  commandArgs: string[]
  config: string
  stack?: string
}

export interface ResourceSizes {
  instances: number
  ram: number // x 1GB
}


export interface DeploymentOptions {
  es: {
    sizes: ResourceSizes
  }
  kb: {
    sizes: ResourceSizes
  }
}

export interface Deployment {
  readonly config: string
  readonly id: string
  readonly name: string
  readonly healthy: boolean
  readonly status: string
  readonly version: string
  readonly zone: string

  delete(): Promise<void>
}

export interface DeploymentCtorOptions {
  config: string
  version: string
  zone: string
  id: string
  name: string
  healthy: boolean
  status: string
  esUrl: string
  kbUrl: string
}

export interface CreateDeploymentOptions {
  config: string
  stack: string
  name: string
  deploymentName: string
  esSize: number
  kbSize: number
}

export interface CreateDeploymentResult {
  id: string
  username: string
  password: string
}

export interface GetDeploymentOptions {
  config: string
  name: string
  id: string
}

export interface GetDeploymentResult {
  healthy: boolean
  status: string
  version: string
  zone: string
  esEndpoint: string
  esPort: number
  kbEndpoint: string
  kbPort: number
}

export interface DeleteDeploymentOptions {
  config: string
  name: string
  id: string
}

export type CommandHandler = (config: string, stack: string | undefined, args: string[]) => Promise<void>