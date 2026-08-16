import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import { claimVisitPing, pingDownload, pingVisit } from "./activity";
import * as env from "./env";

function installSessionStorage(initial: Record<string, string> = {}): void {
  const store = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
    },
  });
}

describe("claimVisitPing", () => {
  test("first claim for a path succeeds", () => {
    expect(claimVisitPing("/first")).toBe(true);
  });

  test("second claim for the same path is a no-op", () => {
    expect(claimVisitPing("/first")).toBe(false);
  });

  test("sessionStorage from a prior load blocks the same path", () => {
    installSessionStorage({ "tax-ui:visit:/from-storage": "1" });
    expect(claimVisitPing("/from-storage")).toBe(false);
  });

  test("different paths are independent", () => {
    expect(claimVisitPing("/a")).toBe(true);
    expect(claimVisitPing("/b")).toBe(true);
  });
});

function mockHostedFetch() {
  const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(null, { status: 200 }),
  );
  spyOn(env, "isHostedEnvironment").mockReturnValue(true);
  return fetchSpy;
}

function requestBody(fetchSpy: ReturnType<typeof mockHostedFetch>, index: number) {
  const init = fetchSpy.mock.calls[index]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
}

describe("pingVisit", () => {
  afterEach(() => {
    mock.restore();
  });

  test("posts a visit once when called twice for the same path", () => {
    const fetchSpy = mockHostedFetch();

    pingVisit();
    pingVisit();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("/api/activity");
    expect(requestBody(fetchSpy, 0)).toEqual({ type: "visit" });
  });
});

describe("pingDownload", () => {
  afterEach(() => {
    mock.restore();
  });

  test("is not gated by the visit claim", () => {
    const fetchSpy = mockHostedFetch();

    pingDownload("mac-arm");
    pingDownload("windows");

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchSpy, 0)).toEqual({
      type: "download",
      platform: "mac-arm",
    });
    expect(requestBody(fetchSpy, 1)).toEqual({
      type: "download",
      platform: "windows",
    });
  });
});
