export interface CliArguments {
  command: string
  commandArgs: string[]
  config: string
}

export interface ResourceSizes {
  instances: number
  ram: number // x 1GB
}

export interface ResourceInfo {
  sizes: ResourceSizes
  healthy: boolean
  status: string
  url: string
}

export interface DeploymentOptions {
  elasticsearch: {
    sizes: ResourceSizes
  }
  kibana: {
    sizes: ResourceSizes
  }
}

export interface Deployment {
  config?: string,
  id: string
  name: string
  created: boolean
  healthy: boolean
  status: string
  credentials: {
    username: string
    password: string
  }
  elasticsearch: ResourceInfo
  kibana: ResourceInfo
}
