import { StatusFilter } from "@shared/types";
import {
  buildDocument,
  buildCollection,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import SearchProviderManager from "@server/utils/SearchProviderManager";
import SmartQADocumentRetriever from "./SmartQADocumentRetriever";

const retriever = new SmartQADocumentRetriever();

beforeEach(() => {
  jest.resetAllMocks();
});

describe("SmartQADocumentRetriever", () => {
  describe("#retrieve", () => {
    it("should return published documents the user has access to", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });
      const document = await buildDocument({
        teamId: team.id,
        collectionId: collection.id,
        title: "Test Document",
        text: "This is a test document about TypeScript",
      });

      const results = await retriever.retrieve(user, "TypeScript");

      expect(results.length).toBeGreaterThan(0);
      const found = results.find((r) => r.id === document.id);
      expect(found).toBeDefined();
      expect(found!.title).toBe("Test Document");
      expect(found!.content).toBe("This is a test document about TypeScript");
      expect(found!.url).toBe(document.path);
      expect(found!.ranking).toBeDefined();
    });

    it("should not return archived documents", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });
      await buildDocument({
        teamId: team.id,
        collectionId: collection.id,
        title: "Archived Doc",
        text: "This is an archived document about JavaScript",
        archivedAt: new Date(),
      });

      const results = await retriever.retrieve(user, "JavaScript");

      const found = results.find((r) => r.title === "Archived Doc");
      expect(found).toBeUndefined();
    });

    it("should not return draft documents", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });
      await buildDocument({
        teamId: team.id,
        collectionId: collection.id,
        title: "Draft Doc",
        text: "This is a draft document about Python",
        publishedAt: null,
      });

      const results = await retriever.retrieve(user, "Python");

      const found = results.find((r) => r.title === "Draft Doc");
      expect(found).toBeUndefined();
    });

    it("should return at most 25 documents", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });

      // Create 30 documents
      for (let i = 0; i < 30; i++) {
        await buildDocument({
          teamId: team.id,
          collectionId: collection.id,
          title: `Document ${i} about search`,
          text: `Content about search topic number ${i}`,
        });
      }

      const results = await retriever.retrieve(user, "search");

      expect(results.length).toBeLessThanOrEqual(25);
    });

    it("should return results sorted by relevance ranking", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      const collection = await buildCollection({
        teamId: team.id,
        userId: user.id,
      });
      await buildDocument({
        teamId: team.id,
        collectionId: collection.id,
        title: "Exact match query",
        text: "Exact match query content",
      });
      await buildDocument({
        teamId: team.id,
        collectionId: collection.id,
        title: "Another document",
        text: "Some other content that mentions query once",
      });

      const results = await retriever.retrieve(user, "query");

      // Verify rankings are in descending order (most relevant first)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].ranking).toBeGreaterThanOrEqual(
          results[i + 1].ranking
        );
      }
    });

    it("should return empty array when no documents match", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });
      await buildCollection({
        teamId: team.id,
        userId: user.id,
      });

      const results = await retriever.retrieve(
        user,
        "xyznonexistentquery12345"
      );

      expect(results).toEqual([]);
    });

    it("should throw an error when search service fails", async () => {
      const team = await buildTeam();
      const user = await buildUser({ teamId: team.id });

      // Mock the search provider to throw an error
      const provider = SearchProviderManager.getProvider();
      jest
        .spyOn(provider, "searchForUser")
        .mockRejectedValueOnce(new Error("Search service unavailable"));

      await expect(retriever.retrieve(user, "test")).rejects.toThrow(
        "Document retrieval failed: Search service unavailable"
      );
    });
  });
});
