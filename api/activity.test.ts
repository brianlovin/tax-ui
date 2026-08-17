import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import handler, { geoMeta } from "./activity";

describe("geoMeta", () => {
  test("copies Vercel latitude and longitude as numbers", () => {
    expect(
      geoMeta({
        "x-vercel-ip-country": "US",
        "x-vercel-ip-latitude": "37.7749",
        "x-vercel-ip-longitude": "-122.4194",
      }),
    ).toEqual({
      country: "US",
      latitude: 37.7749,
      longitude: -122.4194,
    });
  });

  test("falls back to Cloudflare coordinate headers", () => {
    expect(
      geoMeta({
        "cf-iplatitude": "52.52",
        "cf-iplongitude": "13.405",
      }),
    ).toEqual({
      latitude: 52.52,
      longitude: 13.405,
    });
  });

  test("prefers Vercel coordinates over Cloudflare", () => {
    expect(
      geoMeta({
        "x-vercel-ip-latitude": "37.77",
        "x-vercel-ip-longitude": "-122.42",
        "cf-iplatitude": "0",
        "cf-iplongitude": "0",
      }),
    ).toEqual({
      latitude: 37.77,
      longitude: -122.42,
    });
  });

  test("ignores non-finite or out-of-range coordinates", () => {
    expect(
      geoMeta({
        "x-vercel-ip-latitude": "not-a-number",
        "x-vercel-ip-longitude": "200",
      }),
    ).toEqual({});

    expect(
      geoMeta({
        "x-vercel-ip-latitude": "91",
        "x-vercel-ip-longitude": "-122.42",
      }),
    ).toEqual({});

    expect(
      geoMeta({
        "cf-iplatitude": "37.77",
        "cf-iplongitude": "Infinity",
      }),
    ).toEqual({});
  });
});

function mockRes() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(body?: string) {
      this.body = body ?? "";
    },
  };
}

describe("activity handler", () => {
  afterEach(() => {
    mock.restore();
    delete process.env.ACTIVITY_INGEST_HMAC_SECRET;
    delete process.env.ACTIVITY_INGEST_URL;
  });

  test("forwards visitor lat/lng on visit and download envelopes", async () => {
    process.env.ACTIVITY_INGEST_HMAC_SECRET = "test-secret";
    const fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    const headers = {
      "x-vercel-ip-latitude": "37.7749",
      "x-vercel-ip-longitude": "-122.4194",
    };

    await handler({ method: "POST", headers, body: { type: "visit" } }, mockRes());
    await handler(
      { method: "POST", headers, body: { type: "download", platform: "mac-arm" } },
      mockRes(),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const visit = JSON.parse(String((fetchSpy.mock.calls[0]?.[1] as RequestInit).body));
    const download = JSON.parse(String((fetchSpy.mock.calls[1]?.[1] as RequestInit).body));
    expect(visit.type).toBe("visit");
    expect(visit.meta).toEqual(
      expect.objectContaining({ latitude: 37.7749, longitude: -122.4194 }),
    );
    expect(download.type).toBe("download");
    expect(download.meta).toEqual(
      expect.objectContaining({
        platform: "mac-arm",
        latitude: 37.7749,
        longitude: -122.4194,
      }),
    );
  });
});
