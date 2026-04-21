/**
 * validation.test.ts
 *
 * Unit tests for validate() — covers test scenario 04 (text-validation).
 *
 * Validates each supported format:
 *   url, ipv4, ip, ipv6, number, integer, email, regex
 * Including bound checks (min/max) and custom error messages.
 */

import { describe, expect, it } from "vitest";
import { validate } from "./validation";

// ── url ───────────────────────────────────────────────────────────────────────

describe("validate — url", () => {
  it("accepts a valid https URL", () => {
    expect(validate("https://example.com", { format: "url" })).toBeNull();
  });

  it("accepts a URL with a path", () => {
    expect(
      validate("https://example.com/path?q=1", { format: "url" }),
    ).toBeNull();
  });

  it("rejects a bare hostname without scheme", () => {
    expect(validate("example.com", { format: "url" })).toMatch(/URL/i);
  });

  it("uses custom errorMessage on failure", () => {
    expect(
      validate("not-a-url", {
        format: "url",
        errorMessage: "bad url",
      }),
    ).toBe("bad url");
  });
});

// ── ipv4 ──────────────────────────────────────────────────────────────────────

describe("validate — ipv4 (test 04: Server IP question)", () => {
  it("accepts a valid IPv4 address", () => {
    expect(validate("192.168.1.1", { format: "ipv4" })).toBeNull();
  });

  it("accepts 0.0.0.0", () => {
    expect(validate("0.0.0.0", { format: "ipv4" })).toBeNull();
  });

  it("accepts 255.255.255.255", () => {
    expect(validate("255.255.255.255", { format: "ipv4" })).toBeNull();
  });

  it("rejects 'not-an-ip' (scenario from test 04)", () => {
    const err = validate("not-an-ip", {
      format: "ipv4",
      errorMessage: "Must be a valid IPv4 address (e.g. 192.168.1.1)",
    });
    expect(err).toBe("Must be a valid IPv4 address (e.g. 192.168.1.1)");
  });

  it("rejects an octet > 255", () => {
    expect(validate("192.168.1.256", { format: "ipv4" })).not.toBeNull();
  });

  it("rejects a partial address", () => {
    expect(validate("192.168.1", { format: "ipv4" })).not.toBeNull();
  });

  it("trims surrounding whitespace before validating", () => {
    expect(validate("  10.0.0.1  ", { format: "ipv4" })).toBeNull();
  });
});

// ── ip (accepts IPv4 or IPv6) ─────────────────────────────────────────────────

describe("validate — ip", () => {
  it("accepts a valid IPv4 address via 'ip' format", () => {
    expect(validate("10.10.10.10", { format: "ip" })).toBeNull();
  });

  it("accepts a valid IPv6 address via 'ip' format", () => {
    expect(validate("2001:db8::1", { format: "ip" })).toBeNull();
  });

  it("accepts the IPv6 loopback via 'ip' format", () => {
    expect(validate("::1", { format: "ip" })).toBeNull();
  });

  it("rejects an invalid address via 'ip' format", () => {
    expect(validate("abc", { format: "ip" })).not.toBeNull();
  });
});

// ── ipv6 ──────────────────────────────────────────────────────────────────────

describe("validate — ipv6", () => {
  it("accepts a full IPv6 address", () => {
    expect(
      validate("2001:0db8:85a3:0000:0000:8a2e:0370:7334", {
        format: "ipv6",
      }),
    ).toBeNull();
  });

  it("accepts the loopback ::1", () => {
    expect(validate("::1", { format: "ipv6" })).toBeNull();
  });

  it("rejects a plain string", () => {
    expect(validate("not-ipv6", { format: "ipv6" })).not.toBeNull();
  });
});

// ── number ────────────────────────────────────────────────────────────────────

describe("validate — number", () => {
  it("accepts an integer as a number", () => {
    expect(validate("42", { format: "number" })).toBeNull();
  });

  it("accepts a decimal", () => {
    expect(validate("3.14", { format: "number" })).toBeNull();
  });

  it("rejects a non-numeric string", () => {
    expect(validate("abc", { format: "number" })).not.toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validate("", { format: "number" })).not.toBeNull();
  });

  it("rejects a value below min", () => {
    expect(validate("0", { format: "number", min: 1 })).not.toBeNull();
  });

  it("rejects a value above max", () => {
    expect(validate("100", { format: "number", max: 50 })).not.toBeNull();
  });

  it("accepts a value within bounds", () => {
    expect(validate("25", { format: "number", min: 1, max: 100 })).toBeNull();
  });
});

// ── integer (test 04: Port question) ─────────────────────────────────────────

describe("validate — integer (test 04: Port question)", () => {
  it("accepts a valid port in range", () => {
    expect(
      validate("8080", { format: "integer", min: 1, max: 65535 }),
    ).toBeNull();
  });

  it("accepts port 1 (lower bound)", () => {
    expect(validate("1", { format: "integer", min: 1, max: 65535 })).toBeNull();
  });

  it("accepts port 65535 (upper bound)", () => {
    expect(
      validate("65535", { format: "integer", min: 1, max: 65535 }),
    ).toBeNull();
  });

  it("rejects port 99999 (above max) — scenario from test 04", () => {
    const err = validate("99999", {
      format: "integer",
      min: 1,
      max: 65535,
      errorMessage: "Port must be between 1 and 65535",
    });
    expect(err).toBe("Port must be between 1 and 65535");
  });

  it("rejects port 0 (below min)", () => {
    expect(
      validate("0", { format: "integer", min: 1, max: 65535 }),
    ).not.toBeNull();
  });

  it("rejects a decimal", () => {
    expect(validate("80.5", { format: "integer" })).not.toBeNull();
  });

  it("rejects a non-numeric string", () => {
    expect(validate("abc", { format: "integer" })).not.toBeNull();
  });

  it("uses custom errorMessage for min bound", () => {
    const err = validate("0", {
      format: "integer",
      min: 1,
      errorMessage: "custom error",
    });
    expect(err).toBe("custom error");
  });
});

// ── email ─────────────────────────────────────────────────────────────────────

describe("validate — email", () => {
  it("accepts a valid email", () => {
    expect(validate("user@example.com", { format: "email" })).toBeNull();
  });

  it("rejects a missing @", () => {
    expect(validate("userexample.com", { format: "email" })).not.toBeNull();
  });

  it("rejects a missing domain", () => {
    expect(validate("user@", { format: "email" })).not.toBeNull();
  });
});

// ── IP CIDR ranges ────────────────────────────────────────────────────────────

describe("validate — ip CIDR allowlist", () => {
  it("accepts an IP inside an IPv4 CIDR range", () => {
    expect(
      validate("10.0.1.5", { format: "ip", allowlist: ["10.0.0.0/8"] }),
    ).toBeNull();
  });

  it("rejects an IP outside the IPv4 CIDR range", () => {
    expect(
      validate("192.168.1.1", { format: "ip", allowlist: ["10.0.0.0/8"] }),
    ).not.toBeNull();
  });

  it("accepts an exact IP match alongside a CIDR range", () => {
    expect(
      validate("172.16.0.1", {
        format: "ip",
        allowlist: ["10.0.0.0/8", "172.16.0.1"],
      }),
    ).toBeNull();
  });

  it("rejects an IP inside a denylist CIDR range", () => {
    expect(
      validate("169.254.1.1", { format: "ip", denylist: ["169.254.0.0/16"] }),
    ).not.toBeNull();
  });

  it("accepts an IP outside a denylist CIDR range", () => {
    expect(
      validate("192.168.1.1", { format: "ip", denylist: ["169.254.0.0/16"] }),
    ).toBeNull();
  });

  it("accepts an IPv6 address inside an IPv6 CIDR range", () => {
    expect(
      validate("2001:db8::1", { format: "ip", allowlist: ["2001:db8::/32"] }),
    ).toBeNull();
  });

  it("rejects an IPv6 address outside an IPv6 CIDR range", () => {
    expect(
      validate("2001:db9::1", { format: "ip", allowlist: ["2001:db8::/32"] }),
    ).not.toBeNull();
  });

  it("rejects an IPv6 address inside a denylist CIDR range", () => {
    expect(
      validate("fe80::1", { format: "ipv6", denylist: ["fe80::/10"] }),
    ).not.toBeNull();
  });
});

// ── regex ─────────────────────────────────────────────────────────────────────

describe("validate — regex", () => {
  it("accepts input matching the pattern", () => {
    expect(
      validate("abc123", { format: "regex", pattern: "^[a-z]+\\d+$" }),
    ).toBeNull();
  });

  it("rejects input not matching the pattern", () => {
    expect(
      validate("abc", { format: "regex", pattern: "^[a-z]+\\d+$" }),
    ).not.toBeNull();
  });

  it("passes when no pattern is provided", () => {
    expect(validate("anything", { format: "regex" })).toBeNull();
  });

  it("returns an error for an invalid regex pattern", () => {
    expect(
      validate("x", { format: "regex", pattern: "[invalid" }),
    ).not.toBeNull();
  });
});
