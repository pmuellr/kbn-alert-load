import { SpawnSyncOptionsWithStringEncoding } from "child_process"

export interface Scenario {
  name: string
  sortName?: string
  version: string
  esSpec: string
  kbSpec: string
  alerts: number
  alertInterval: string
  tmPollInterval: number
  tmMaxWorkers: number
}

export interface Suite {
  id: string
  description: string
  scenarios: Scenario[]
}

export interface CliArguments {
  command: string
  commandArgs: string[]
  config: string
  minutes: number
  percentFiring: number
}

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
  readonly kbInstances: number
  readonly scenario: Scenario

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
  kbInstances: number
  scenario: Scenario
}

export interface CreateDeploymentOptions {
  config: string
  stack: string
  name: string
  deploymentName: string
  esSize: number
  kbSize: number
  tmPollInterval: number
  tmMaxWorkers: number
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
  minutes: number
  percentFiring: number
}

export type CommandHandler = (
  options: CommandOptions,
  args: string[]
) => Promise<void>

export interface EventLogRecord {
  scenario: string
  provider: string
  date: string
  duration: number
  outcome: string
  alert?: string
  action?: string
}

export interface RunningAverageP {
  "p50": number;
  "p90": number;
  "p95": number;
  "p99": number;
}
export interface TaskManagerStats {
	id: string;
	timestamp:  string;
  scenario: string;
  stats: {
		configuration: {
			value: {
				poll_interval: number;
				max_workers: number;
			}
		};
    runtime: {
      value: {
        drift: RunningAverageP;
        load: RunningAverageP;
        polling: {
          last_successful_poll: string;
          last_polling_delay: string;
          duration: RunningAverageP;
          claim_conflicts: RunningAverageP;
          claim_mismatches: RunningAverageP;
          result_frequency_percent_as_number: {
            NoTasksClaimed: number;
            RanOutOfCapacity: number;
            PoolFilled: number;
          }
        },
        execution: {
          duration: {
            "alerting:.index-threshold"?: RunningAverageP;
          },
          result_frequency_percent_as_number: {
            "alerting:.index-threshold"?: {
              Success: number;
              RetryScheduled: number;
              Failed: number;
            }
          }
        },
      }
    };
    workload: {
      timestamp: string;
      value: {
        estimated_schedule_density: number[];
      }
    }
  }
}

export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T
