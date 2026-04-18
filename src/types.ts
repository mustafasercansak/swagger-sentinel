export type Severity = 'error' | 'warning' | 'suggestion';

export interface ValidationResult {
  id: string;
  category: string;
  severity: Severity;
  passed: boolean;
  message: string;
  details?: string | null;
}

export type ValidatorFunction = (spec: any) => ValidationResult[];

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
    termsOfService?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    responses?: Record<string, any>;
    parameters?: Record<string, any>;
    examples?: Record<string, any>;
    requestBodies?: Record<string, any>;
    headers?: Record<string, any>;
    securitySchemes?: Record<string, any>;
    links?: Record<string, any>;
    callbacks?: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
    externalDocs?: any;
  }>;
  externalDocs?: any;
}

export interface SentinelConfig {
  strict?: boolean;
  ignore?: string[];
  overrides?: Record<string, Severity>;
  generate?: {
    seed?: number | string;
    baseUrl?: string;
    output?: string;
  };
}
