import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";

import { classifyPages } from "./classifier";

async function createPdf(pageCount: number): Promise<string> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  const bytes = await doc.save();
  return Buffer.from(bytes).toString("base64");
}

// Fake Anthropic client that records whether it was called
function fakeClient(called: { value: boolean }) {
  return {
    messages: {
      create: () => {
        called.value = true;
      },
    },
  } as never;
}

describe("classifyPages", () => {
  test("small PDF (≤20 pages) returns all pages as 'other' without API call", async () => {
    const called = { value: false };
    const pdf = await createPdf(15);
    const result = await classifyPages(pdf, fakeClient(called));

    expect(called.value).toBe(false);
    expect(result).toHaveLength(15);
    result.forEach((classification, i) => {
      expect(classification.pageNumber).toBe(i + 1);
      expect(classification.formType).toBe("other");
    });
  });

  test("exactly 20 pages still bypasses API", async () => {
    const called = { value: false };
    const pdf = await createPdf(20);
    const result = await classifyPages(pdf, fakeClient(called));

    expect(called.value).toBe(false);
    expect(result).toHaveLength(20);
  });

  test("single page PDF returns one classification", async () => {
    const called = { value: false };
    const pdf = await createPdf(1);
    const result = await classifyPages(pdf, fakeClient(called));

    expect(called.value).toBe(false);
    expect(result).toHaveLength(1);
    expect(result[0]!.pageNumber).toBe(1);
    expect(result[0]!.formType).toBe("other");
  });
});
