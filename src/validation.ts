/**
 * validation.ts — Per-format validator definitions for ask-user-question.
 *
 * Design: each format owns a TypeBox param schema + a pure validate function.
 * The function's parameter type is derived from the schema via Static<>,
 * so the schema is the single source of truth for both JSON validation and TS types.
 *
 * Public API:
 *   ValidationSchema     — discriminated TypeBox union (used by schema.ts for the LLM)
 *   ValidationConfig     — Static<typeof ValidationSchema> — the JSON-serializable form
 *   validate()           — dispatches to the right implementation via `format`
 *   createValidator()    — wraps validate() into a zero-arg callable for a fixed config
 *
 * Adding a new format:
 *   1. Define its TypeBox schema (must include `format: Type.Literal("...")`).
 *   2. Derive the TS type: `type XConfig = Static<typeof xSchema>`.
 *   3. Write `validateX(value: string, c: XConfig): string | null`.
 *   4. Add the schema to the ValidationSchema union and a case to validate().
 */

import * as net from "node:net";
import { type Static, Type } from "@sinclair/typebox";
import { z } from "zod";

// ── Shared building blocks ────────────────────────────────────────────────────

const errorMsg = Type.Optional(
  Type.String({
    description:
      "Custom error message — overrides the built-in message on failure",
    examples: ["Must be a valid URL", "Port must be between 1 and 65535"],
  }),
);

/** Shared min/max bounds fields, reused in number and integer schemas. */
const numBounds = {
  min: Type.Optional(
    Type.Number({ description: "Minimum allowed value (inclusive)" }),
  ),
  max: Type.Optional(
    Type.Number({ description: "Maximum allowed value (inclusive)" }),
  ),
};

// ── URL ──────────────────────────────────────────────────────────────────────

const urlSchema = Type.Object(
  {
    format: Type.Literal("url"),
    protocols: Type.Optional(
      Type.Array(Type.String(), {
        description: "Allowed URL schemes — accepts all schemes when omitted",
        examples: [["https"], ["https", "http"]],
      }),
    ),
    errorMessage: errorMsg,
  },
  {
    description:
      "Validates a well-formed URL, optionally restricted to specific schemes",
    examples: [{ format: "url" }, { format: "url", protocols: ["https"] }],
  },
);

function validateUrl(
  value: string,
  c: Static<typeof urlSchema>,
): string | null {
  const t = value.trim();
  if (!z.url().safeParse(t).success) {
    return (
      c.errorMessage ??
      "Invalid format — expected a valid URL (e.g. https://example.com)"
    );
  }
  if (c.protocols) {
    const scheme = new URL(t).protocol.replace(/:$/, "");
    if (!c.protocols.includes(scheme)) {
      return (
        c.errorMessage ?? `URL scheme must be one of: ${c.protocols.join(", ")}`
      );
    }
  }
  return null;
}

// ── Email ─────────────────────────────────────────────────────────────────────

const emailSchema = Type.Object(
  {
    format: Type.Literal("email"),
    domainAllowlist: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Accept only these domains — all domains accepted when omitted",
        examples: [["example.com", "company.org"]],
      }),
    ),
    domainDenylist: Type.Optional(
      Type.Array(Type.String(), {
        description: "Reject these domains (applied after allowlist)",
        examples: [["tempmail.com"]],
      }),
    ),
    errorMessage: errorMsg,
  },
  {
    description:
      "Validates an email address (user@domain.tld) with optional domain filtering",
    examples: [
      { format: "email" },
      { format: "email", domainAllowlist: ["example.com"] },
    ],
  },
);

function validateEmail(
  value: string,
  c: Static<typeof emailSchema>,
): string | null {
  const t = value.trim();
  if (!z.email().safeParse(t).success) {
    return c.errorMessage ?? "Invalid format — expected a valid email address";
  }
  const domain = t.split("@")[1]!;
  if (c.domainAllowlist && !c.domainAllowlist.includes(domain)) {
    return (
      c.errorMessage ?? `Domain must be one of: ${c.domainAllowlist.join(", ")}`
    );
  }
  if (c.domainDenylist?.includes(domain)) {
    return c.errorMessage ?? `Domain ${domain} is not allowed`;
  }
  return null;
}

// ── IP (any version) ──────────────────────────────────────────────────────────

const ipSchema = Type.Union(
  [
    Type.Object({
      format: Type.Literal("ip"),
      allowlist: Type.Array(Type.String(), {
        description:
          "Accept only these addresses or CIDR ranges (e.g. 192.168.1.0/24, 2001:db8::/32)",
        examples: [["10.0.0.0/8", "192.168.1.1"]],
      }),
      errorMessage: errorMsg,
    }),
    Type.Object({
      format: Type.Literal("ip"),
      denylist: Type.Array(Type.String(), {
        description: "Reject these addresses or CIDR ranges",
        examples: [["169.254.0.0/16"]],
      }),
      errorMessage: errorMsg,
    }),
    Type.Object({ format: Type.Literal("ip"), errorMessage: errorMsg }),
  ],
  {
    description:
      "Accepts IPv4 or IPv6 — use ipv4/ipv6 to enforce a specific version",
    examples: [{ format: "ip" }, { format: "ip", allowlist: ["10.0.0.0/8"] }],
  },
);

function validateIp(value: string, c: Static<typeof ipSchema>): string | null {
  const t = value.trim();
  if (!z.union([z.ipv4(), z.ipv6()]).safeParse(t).success) {
    return (
      c.errorMessage ??
      "Invalid format — expected a valid IP address (IPv4 or IPv6)"
    );
  }
  return checkIpLists(t, c as IpListConfig);
}

// ── IPv4 ──────────────────────────────────────────────────────────────────────

const ipv4Schema = Type.Union(
  [
    Type.Object({
      format: Type.Literal("ipv4"),
      allowlist: Type.Array(Type.String(), {
        description:
          "Accept only these IPv4 addresses or CIDR ranges (e.g. 10.0.0.0/8)",
        examples: [["10.0.0.0/8", "192.168.1.1"]],
      }),
      errorMessage: errorMsg,
    }),
    Type.Object({
      format: Type.Literal("ipv4"),
      denylist: Type.Array(Type.String(), {
        description: "Reject these IPv4 addresses or CIDR ranges",
        examples: [["169.254.0.0/16"]],
      }),
      errorMessage: errorMsg,
    }),
    Type.Object({ format: Type.Literal("ipv4"), errorMessage: errorMsg }),
  ],
  {
    description: "Strict dotted-decimal IPv4 — each octet 0–255",
    examples: [
      { format: "ipv4" },
      { format: "ipv4", denylist: ["169.254.0.0/16"] },
    ],
  },
);

function validateIpv4(
  value: string,
  c: Static<typeof ipv4Schema>,
): string | null {
  const t = value.trim();
  if (!z.ipv4().safeParse(t).success) {
    return (
      c.errorMessage ??
      "Invalid format — expected a valid IPv4 address (e.g. 192.168.1.1)"
    );
  }
  return checkIpLists(t, c as IpListConfig);
}

// ── IPv6 ──────────────────────────────────────────────────────────────────────

const ipv6Schema = Type.Union(
  [
    Type.Object({
      format: Type.Literal("ipv6"),
      allowlist: Type.Array(Type.String(), {
        description:
          "Accept only these IPv6 addresses or CIDR ranges (e.g. 2001:db8::/32)",
        examples: [["2001:db8::/32"]],
      }),
      errorMessage: errorMsg,
    }),
    Type.Object({
      format: Type.Literal("ipv6"),
      denylist: Type.Array(Type.String(), {
        description: "Reject these IPv6 addresses or CIDR ranges",
        examples: [["fe80::/10"]],
      }),
      errorMessage: errorMsg,
    }),
    Type.Object({ format: Type.Literal("ipv6"), errorMessage: errorMsg }),
  ],
  {
    description: "RFC 4291 IPv6 address",
    examples: [
      { format: "ipv6" },
      { format: "ipv6", allowlist: ["2001:db8::/32"] },
    ],
  },
);

function validateIpv6(
  value: string,
  c: Static<typeof ipv6Schema>,
): string | null {
  const t = value.trim();
  if (!z.ipv6().safeParse(t).success) {
    return c.errorMessage ?? "Invalid format — expected a valid IPv6 address";
  }
  return checkIpLists(t, c as IpListConfig);
}

// ── net.BlockList helpers ─────────────────────────────────────────────────────

/** Shared type for the allow/deny list config passed to checkIpLists. */
interface IpListConfig {
  allowlist?: string[];
  denylist?: string[];
  errorMessage?: string;
}

/**
 * Builds a net.BlockList from an array of exact IP addresses or CIDR ranges.
 * Returns null and sets `errorOut[0]` if any entry is malformed.
 */
function buildBlockList(
  entries: string[],
  errorOut: [string | undefined],
): net.BlockList | null {
  try {
    const list = new net.BlockList();
    for (const entry of entries) {
      const slash = entry.indexOf("/");
      if (slash === -1) {
        list.addAddress(entry);
      } else {
        const network = entry.slice(0, slash);
        const prefix = parseInt(entry.slice(slash + 1), 10);
        if (Number.isNaN(prefix)) {
          errorOut[0] = `Invalid CIDR prefix in entry: ${entry}`;
          return null;
        }
        const type = network.includes(":") ? "ipv6" : "ipv4";
        list.addSubnet(network, prefix, type);
      }
    }
    return list;
  } catch (e) {
    errorOut[0] = `Invalid IP/CIDR entry in list: ${(e as Error).message}`;
    return null;
  }
}

/** Shared allow/deny list check for IP validators using net.BlockList. */
function checkIpLists(ip: string, c: IpListConfig): string | null {
  const type = ip.includes(":") ? "ipv6" : "ipv4";
  const err: [string | undefined] = [undefined];
  if (c.allowlist) {
    const list = buildBlockList(c.allowlist, err);
    if (!list) return err[0] ?? "Invalid IP allowlist configuration";
    if (!list.check(ip, type)) {
      return c.errorMessage ?? `Address must be in: ${c.allowlist.join(", ")}`;
    }
  }
  if (c.denylist) {
    const list = buildBlockList(c.denylist, err);
    if (!list) return err[0] ?? "Invalid IP denylist configuration";
    if (list.check(ip, type)) {
      return c.errorMessage ?? `Address ${ip} is not allowed`;
    }
  }
  return null;
}

// ── Number ────────────────────────────────────────────────────────────────────

const numberSchema = Type.Object(
  { format: Type.Literal("number"), ...numBounds, errorMessage: errorMsg },
  {
    description:
      "Any finite decimal or integer; optional inclusive min/max bounds",
    examples: [{ format: "number" }, { format: "number", min: 0, max: 100 }],
  },
);

function validateNumber(
  value: string,
  c: Static<typeof numberSchema>,
): string | null {
  return _validateNumeric(value, c, false);
}

// ── Integer ───────────────────────────────────────────────────────────────────

const integerSchema = Type.Object(
  { format: Type.Literal("integer"), ...numBounds, errorMessage: errorMsg },
  {
    description:
      "Whole number only (no decimal part); optional inclusive min/max bounds",
    examples: [
      { format: "integer", min: 1 },
      { format: "integer", min: 0, max: 255 },
    ],
  },
);

function validateInteger(
  value: string,
  c: Static<typeof integerSchema>,
): string | null {
  return _validateNumeric(value, c, true);
}

/**
 * Shared validator for number and integer formats.
 *
 * @param value   Raw user input (trimmed internally).
 * @param c       Schema config with optional `min`, `max`, `errorMessage`.
 * @param integer When `true`, rejects non-whole numbers.
 */
function _validateNumeric(
  value: string,
  c: { min?: number; max?: number; errorMessage?: string },
  integer: boolean,
): string | null {
  const t = value.trim();
  const n = Number(t);
  const defaultMsg = integer
    ? "Invalid format — expected a whole number"
    : "Invalid format — expected a numeric value";
  const isValid = integer ? Number.isInteger(n) : Number.isFinite(n);
  if (t === "" || !isValid) return c.errorMessage ?? defaultMsg;
  if (c.min !== undefined && n < c.min)
    return c.errorMessage ?? `Value must be ≥ ${c.min}`;
  if (c.max !== undefined && n > c.max)
    return c.errorMessage ?? `Value must be ≤ ${c.max}`;
  return null;
}

// ── Regex ─────────────────────────────────────────────────────────────────────

const regexSchema = Type.Object(
  {
    format: Type.Literal("regex"),
    pattern: Type.Optional(
      Type.String({
        description:
          "JS regex pattern without delimiters — capped at 500 chars. Note: pattern length alone does not prevent ReDoS; input is also capped to limit backtracking.",
        examples: ["^[A-Z][a-z]+$", "^\\d{4}-\\d{2}-\\d{2}$"],
        maxLength: 500,
      }),
    ),
    errorMessage: errorMsg,
  },
  {
    description: "Matches the input against a custom JS regular expression",
    examples: [{ format: "regex", pattern: "^[A-Z]" }],
  },
);

/** Maximum length of input tested against a regex pattern, to limit backtracking. */
const MAX_REGEX_INPUT_LENGTH = 1000;

function validateRegex(
  value: string,
  c: Static<typeof regexSchema>,
): string | null {
  if (!c.pattern) return null;
  if (c.pattern.length > 500)
    return "Invalid configuration — regex pattern exceeds 500 chars";
  const input = value.trim().slice(0, MAX_REGEX_INPUT_LENGTH);
  try {
    return new RegExp(c.pattern).test(input)
      ? null
      : (c.errorMessage ??
          `Input does not match the expected pattern /${c.pattern}/`);
  } catch (e) {
    return `Invalid regex pattern in validation configuration: ${(e as Error).message}`;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Discriminated union of all validator config schemas.
 * Used by `schema.ts` to describe the `validation` field for the LLM.
 */
export const StringValidationSchema = Type.Union([
  urlSchema,
  emailSchema,
  ipSchema,
  ipv4Schema,
  ipv6Schema,
  numberSchema,
  integerSchema,
  regexSchema,
]);

/** TypeScript type inferred from {@link StringValidationSchema} — the JSON-serializable form. */
export type StringValidationConfig = Static<typeof StringValidationSchema>;

/**
 * Discriminated union of numeric validator schemas (number and integer) for convenient
 * type narrowing in NumberInput.
 * Used by `schema.ts` to describe the `validation` field for numeric questions.
 */
export const NumericValidationSchema = Type.Union([
  numberSchema,
  integerSchema,
]);

/** TypeScript type inferred from {@link NumericValidationSchema}. */
export type NumericValidationConfig = Static<typeof NumericValidationSchema>;

/**
 * Dispatches to the appropriate format validator.
 *
 * @param value  - Raw user input (trimmed internally before checking).
 * @param config - Validation config, discriminated by `format`.
 * @returns `null` if valid, or a human-readable error message on failure.
 */
export function validate(
  value: string,
  config: StringValidationConfig | NumericValidationConfig,
): string | null {
  switch (config.format) {
    case "url":
      return validateUrl(value, config);
    case "email":
      return validateEmail(value, config);
    case "ip":
      return validateIp(value, config);
    case "ipv4":
      return validateIpv4(value, config);
    case "ipv6":
      return validateIpv6(value, config);
    case "number":
      return validateNumber(value, config);
    case "integer":
      return validateInteger(value, config);
    case "regex":
      return validateRegex(value, config);
    default: {
      const exhaustive: never = config;
      return `Invalid validation configuration — unsupported format: ${String((exhaustive as { format: unknown }).format)}`;
    }
  }
}

/**
 * Wraps a fixed config into a single-argument validator function.
 * Useful when the config is known at construction time (e.g. in Input classes).
 *
 * @param config - Validation config.
 * @returns A function `(value: string) => string | null`.
 */
export function createValidator(
  config: StringValidationConfig,
): (value: string) => string | null {
  return (value) => validate(value, config);
}
