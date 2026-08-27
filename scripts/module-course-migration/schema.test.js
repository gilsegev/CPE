const test = require("node:test");
const assert = require("node:assert/strict");
const { verifyFeedbackPermissions } = require("./schema");

test("feedback permission verification rejects non-administrator Directus access", async () => {
  const client = {
    async request(pathname) {
      if (pathname === "/server/info") return { version: "11.8.0" };
      if (pathname === "/policies?limit=-1") return [
        { id: "admin", name: "Administrator" },
        { id: "student", name: "Student" },
      ];
      if (pathname === "/permissions?limit=-1") return [
        { id: "p1", policy: "student", collection: "FeedbackResponses", action: "read" },
        { id: "p2", policy: "admin", collection: "FeedbackResponses", action: "read" },
      ];
      throw new Error(`Unexpected request ${pathname}`);
    },
  };

  assert.deepEqual(await verifyFeedbackPermissions(client), [
    "permission FeedbackResponses.read granted to Student",
  ]);
});
