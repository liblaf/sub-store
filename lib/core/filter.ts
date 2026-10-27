import { z } from "zod";

/** Compile provider and group patterns without including input in errors. */
export function compilePattern(pattern: string): RegExp {
  try {
    return pattern.startsWith("(?i)") ? new RegExp(pattern.slice(4), "i") : new RegExp(pattern);
  } catch {
    throw new Error("Invalid regular expression");
  }
}

export const REGEX_PATTERN_SCHEMA = z.string().refine(
  (pattern: string): boolean => {
    try {
      compilePattern(pattern);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Invalid regular expression" },
);
