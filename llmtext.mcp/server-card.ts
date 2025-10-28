/**
 * MCP Server Card Schema
 * Represents static server metadata for discovery
 *
 * Preliminarily generated using context - https://contextarea.com/rules-httpsuithu-zdm3d3592u4gnw
 */

// ============================================================================
// Core Server Card Interface
// ============================================================================

export interface MCPServerCard {
  /**
   * URL to the JSON schema definition for the MCP Server Card format
   */
  $schema: string;

  /**
   * Schema version for the server card document (e.g., "1.0")
   */
  version: string;

  /**
   * The MCP protocol version the server supports (e.g., "2025-06-18")
   */
  protocolVersion: string;

  /**
   * Server identification information
   */
  serverInfo: ServerImplementation;

  /**
   * Human-readable description of the server
   */
  description?: string;

  /**
   * URL to an icon representing the server (deprecated in favor of icons array)
   * @deprecated Use icons instead
   */
  iconUrl?: string;

  /**
   * Optional set of sized icons for display
   */
  icons?: Icon[];

  /**
   * URL to the server's documentation or homepage
   */
  documentationUrl?: string;

  /**
   * Transport configuration
   */
  transport: TransportConfig;

  /**
   * Server capabilities
   */
  capabilities: ServerCapabilities;

  /**
   * Required client capabilities
   */
  requires?: ClientCapabilities;

  /**
   * Authentication requirements
   */
  authentication?: AuthenticationConfig;

  /**
   * Usage instructions for the server
   */
  instructions?: string;

  /**
   * Resource definitions - either "dynamic" or static array
   */
  resources?: "dynamic" | Resource[];

  /**
   * Tool definitions - either "dynamic" or static array
   */
  tools?: "dynamic" | Tool[];

  /**
   * Prompt definitions - either "dynamic" or static array
   */
  prompts?: "dynamic" | Prompt[];

  /**
   * Additional metadata
   */
  _meta?: { [key: string]: unknown };
}

// ============================================================================
// Server Implementation (extends base Implementation)
// ============================================================================

export interface ServerImplementation extends Implementation {
  /**
   * Server identifier for programmatic use (reverse-DNS format recommended)
   * Example: "com.github/mcp-server"
   */
  name: string;

  /**
   * Human-readable server display name
   */
  title?: string;

  /**
   * Server software version (semantic versioning recommended)
   */
  version: string;

  /**
   * Optional URL of the website for this implementation
   */
  websiteUrl?: string;

  /**
   * Optional set of sized icons
   */
  icons?: Icon[];
}

export interface Implementation {
  name: string;
  title?: string;
  version: string;
  websiteUrl?: string;
  icons?: Icon[];
}

// ============================================================================
// Icon Definition
// ============================================================================

export interface Icon {
  /**
   * URI pointing to an icon resource (HTTP/HTTPS URL or data: URI)
   */
  src: string;

  /**
   * Optional MIME type override (e.g., "image/png", "image/svg+xml")
   */
  mimeType?: string;

  /**
   * Optional array of sizes (e.g., ["48x48", "96x96", "any"])
   */
  sizes?: string[];

  /**
   * Optional theme specifier ("light" or "dark")
   */
  theme?: "light" | "dark";
}

// ============================================================================
// Transport Configuration
// ============================================================================

export type TransportConfig =
  | StreamableHttpTransport
  | SseTransport
  | StdioTransport;

export interface StreamableHttpTransport {
  type: "streamable-http";
  /**
   * Transport endpoint path (e.g., "/mcp")
   */
  endpoint: string;
  /**
   * Optional URL template variables
   */
  variables?: TransportVariables;
}

export interface SseTransport {
  type: "sse";
  /**
   * Full URL for SSE endpoint (may include variables)
   */
  url: string;
  /**
   * Optional URL template variables
   */
  variables?: TransportVariables;
}

export interface StdioTransport {
  type: "stdio";
  /**
   * Command to execute
   */
  command?: string;
  /**
   * Command arguments
   */
  args?: string[];
}

export interface TransportVariables {
  [variableName: string]: {
    description: string;
    isRequired: boolean;
  };
}

// ============================================================================
// Capabilities
// ============================================================================

export interface ServerCapabilities {
  experimental?: { [key: string]: object };
  logging?: object;
  completions?: object;
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
}

export interface ClientCapabilities {
  experimental?: { [key: string]: object };
  roots?: {
    listChanged?: boolean;
  };
  sampling?: object;
  elicitation?: object;
}

// ============================================================================
// Authentication Configuration
// ============================================================================

export interface AuthenticationConfig {
  /**
   * Whether authentication is mandatory
   */
  required: boolean;

  /**
   * Supported authentication schemes (e.g., ["bearer", "oauth2"])
   */
  schemes: string[];
}

// ============================================================================
// Resource Definition
// ============================================================================

export interface Resource extends BaseMetadata, Icons {
  /**
   * The URI of this resource
   */
  uri: string;

  /**
   * A description of what this resource represents
   */
  description?: string;

  /**
   * The MIME type of this resource, if known
   */
  mimeType?: string;

  /**
   * Optional annotations for the client
   */
  annotations?: Annotations;

  /**
   * The size of the raw resource content in bytes, if known
   */
  size?: number;

  /**
   * Additional metadata
   */
  _meta?: { [key: string]: unknown };
}

// ============================================================================
// Tool Definition
// ============================================================================

export interface Tool extends BaseMetadata, Icons {
  /**
   * A human-readable description of the tool
   */
  description?: string;

  /**
   * JSON Schema object defining expected parameters
   */
  inputSchema: {
    type: "object";
    properties?: { [key: string]: object };
    required?: string[];
  };

  /**
   * Optional JSON Schema defining output structure
   */
  outputSchema?: {
    type: "object";
    properties?: { [key: string]: object };
    required?: string[];
  };

  /**
   * Optional additional tool information
   */
  annotations?: ToolAnnotations;

  /**
   * Additional metadata
   */
  _meta?: { [key: string]: unknown };
}

export interface ToolAnnotations {
  /**
   * Human-readable title for the tool
   */
  title?: string;

  /**
   * If true, the tool does not modify its environment
   */
  readOnlyHint?: boolean;

  /**
   * If true, the tool may perform destructive updates
   */
  destructiveHint?: boolean;

  /**
   * If true, calling repeatedly with same args has no additional effect
   */
  idempotentHint?: boolean;

  /**
   * If true, tool may interact with "open world" of external entities
   */
  openWorldHint?: boolean;
}

// ============================================================================
// Prompt Definition
// ============================================================================

export interface Prompt extends BaseMetadata, Icons {
  /**
   * An optional description of what this prompt provides
   */
  description?: string;

  /**
   * A list of arguments to use for templating the prompt
   */
  arguments?: PromptArgument[];

  /**
   * Additional metadata
   */
  _meta?: { [key: string]: unknown };
}

export interface PromptArgument extends BaseMetadata {
  /**
   * A human-readable description of the argument
   */
  description?: string;

  /**
   * Whether this argument must be provided
   */
  required?: boolean;
}

// ============================================================================
// Base Interfaces and Supporting Types
// ============================================================================

export interface BaseMetadata {
  /**
   * Intended for programmatic or logical use
   */
  name: string;

  /**
   * Intended for UI and end-user contexts
   */
  title?: string;
}

export interface Icons {
  /**
   * Optional set of sized icons that the client can display
   */
  icons?: Icon[];
}

export interface Annotations {
  /**
   * Describes who the intended customer of this object or data is
   */
  audience?: Role[];

  /**
   * Describes how important this data is (0-1, where 1 is most important)
   */
  priority?: number;

  /**
   * ISO 8601 formatted timestamp of last modification
   */
  lastModified?: string;
}

export type Role = "user" | "assistant";

// ============================================================================
// Multiple Server Cards (for .well-known/mcp response)
// ============================================================================

/**
 * Response type for .well-known/mcp endpoint
 * Can be a single card or an array of cards
 */
export type MCPServerCardResponse = MCPServerCard | MCPServerCard[];
