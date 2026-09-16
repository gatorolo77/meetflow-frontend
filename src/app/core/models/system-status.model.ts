export type ServiceHealthStatus = 'OPTIMAL' | 'DEGRADED' | 'DOWN';

export interface SystemServiceStatus {
  id: string;
  name: string;
  status: ServiceHealthStatus;
  statusText: string;
  icon: string;
}

export interface SystemHealthSummary {
  overallOperational: boolean;
  services: SystemServiceStatus[];
}
