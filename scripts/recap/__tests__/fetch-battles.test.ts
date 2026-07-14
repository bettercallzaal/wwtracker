import { describe, it, expect } from "vitest";
import { fetchNewBattles } from "@/scripts/ww-battles-fetch";
import type { StoredBattle } from "@/scripts/recap/types";

function battleHtml(battleId: number, marginPct: number | null = 98): string {
  return String.raw`<script>self.__next_f.push([1,"3:[\"$\",\"$L20\",\"${battleId}\",{\"data\":{\"battle_id\":${battleId},\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"A\",\"song2Title\":\"B\",\"song1Handle\":null,\"song2Handle\":null,\"totalVolSol\":\"1.0\",\"winnerTitle\":\"A\",\"loserTitle\":\"B\",\"marginPct\":${marginPct === null ? "null" : `\\"${marginPct}\\"`}}}]"]);</script>`;
}

const existingBattle: StoredBattle = {
  id: "100", type: "QUICK", date: "Jul 10, 2026", a: "X", b: "Y",
  aHandle: null, bHandle: null, winner: "X", vol: 1, margin: 50,
};

describe("fetchNewBattles", () => {
  it("stops paginating once a page yields zero new battles", async () => {
    const pages = [battleHtml(200), battleHtml(100)]; // page 2 is all-known
    const fetchPage = async (page: number) => pages[page - 1];
    const result = await fetchNewBattles([existingBattle], fetchPage, 10);
    expect(result.pagesFetched).toBe(2);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe("200");
  });

  it("merges added battles into the returned merged list", async () => {
    const fetchPage = async () => battleHtml(200);
    const result = await fetchNewBattles([existingBattle], fetchPage, 1);
    expect(result.merged).toHaveLength(2);
  });

  it("fails loud (throws) if a page parses to zero battles", async () => {
    const fetchPage = async () => "<html>empty</html>";
    await expect(fetchNewBattles([existingBattle], fetchPage, 5)).rejects.toThrow(/zero battles/);
  });

  it("respects maxPages as a hard stop", async () => {
    let calls = 0;
    const fetchPage = async (page: number) => {
      calls += 1;
      return battleHtml(1000 + page); // always a new id - never stops naturally
    };
    const result = await fetchNewBattles([existingBattle], fetchPage, 3);
    expect(calls).toBe(3);
    expect(result.pagesFetched).toBe(3);
  });
});
