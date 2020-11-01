export interface DeploymentSpec {
  es: string // AxB - a instances with b gb of ram; eg 1x4
  kb: string // "
}

export interface Scenario {
  id: string
  minutes: number
  deployments: Array<DeploymentSpec>
  alerts: number
}

export interface CliArguments {
  command: string
  commandArgs: string[]
  config: string
  stack?: string
  minutes?: number
}

// export interface ResourceSizes {
//   instances: number
//   ram: number // x 1GB
// }

export interface Deployment {
  readonly config: string
  readonly id: string
  readonly name: string
  readonly healthy: boolean
  readonly status: string
  readonly version: string
  readonly zone: string
  readonly esUrl: string
  readonly kbUrl: string

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

export interface CommandOptions {
  config: string
  stack: string
  minutes: number
}

export type CommandHandler = (
  options: CommandOptions,
  args: string[]
) => Promise<void>

export interface EventLogRecord {
  deployment: string
  provider: string
  date: string
  duration: number
  outcome: string
  alert?: string
  action?: string
}

export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
