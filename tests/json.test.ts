import { it, expect } from "vitest";
import { parseJsonStrict } from "../src/shared/json";
it("rejects duplicate ledger date keys before either record can be lost", () => {
  expect(() =>
    parseJsonStrict(
      '{"ledger":{"2026-10-01":{"amountCents":100},"2026-10-01":{"amountCents":200}}}',
    ),
  ).toThrow("重复");
});
it("rejects escaped-equivalent duplicate names", () =>
  expect(() => parseJsonStrict('{"a":1,"\\u0061":2}')).toThrow("重复"));
it("allows same property names in different objects and punctuation inside values", () =>
  expect(
    parseJsonStrict('{"one":{"a":"x,{}:"},"two":{"a":2},"array":[{"a":3}]}'),
  ).toEqual({ one: { a: "x,{}:" }, two: { a: 2 }, array: [{ a: 3 }] }));
it("rejects malformed JSON", () =>
  expect(() => parseJsonStrict('{"a":1,}')).toThrow());
