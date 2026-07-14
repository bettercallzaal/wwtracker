import { describe, it, expect } from "vitest";
import { parseWaveWarzBattlesPage } from "@/scripts/recap/battle-parser";

const FIXTURE_HTML = String.raw`
<script>self.__next_f.push([1,"3:[\"$\",\"$L20\",\"1784001227\",{\"data\":{\"battle_id\":1784001227,\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"Saturday in LA\",\"song2Title\":\"CUTTING OLD TIES\",\"song1Handle\":\"BennyJ504WaveWarz\",\"song2Handle\":\"frameworkfortune\",\"totalVolSol\":\"0.5152\",\"winnerTitle\":\"Saturday in LA\",\"loserTitle\":\"CUTTING OLD TIES\",\"marginPct\":\"98\"}}],[\"$\",\"$L20\",\"1783999631\",{\"data\":{\"battle_id\":1783999631,\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"INTRO\",\"song2Title\":\"Say Nothin\",\"song1Handle\":null,\"song2Handle\":\"RoCkY2GriMeY\",\"totalVolSol\":\"0.1477\",\"winnerTitle\":\"INTRO\",\"loserTitle\":\"Say Nothin\",\"marginPct\":null}}]"]);</script>
`;

describe("parseWaveWarzBattlesPage", () => {
  it("extracts every battle object on the page", () => {
    const battles = parseWaveWarzBattlesPage(FIXTURE_HTML);
    expect(battles).toHaveLength(2);
  });

  it("normalizes numeric-string fields to numbers", () => {
    const battles = parseWaveWarzBattlesPage(FIXTURE_HTML);
    const first = battles.find((b) => b.battleId === 1784001227);
    expect(first?.totalVolumeSol).toBe(0.5152);
    expect(first?.marginPct).toBe(98);
  });

  it("preserves null for a missing field", () => {
    const battles = parseWaveWarzBattlesPage(FIXTURE_HTML);
    const second = battles.find((b) => b.battleId === 1783999631);
    expect(second?.song1Handle).toBeNull();
    expect(second?.marginPct).toBeNull();
  });

  it("dedupes if the same battle_id appears twice", () => {
    const doubled = FIXTURE_HTML + FIXTURE_HTML;
    const battles = parseWaveWarzBattlesPage(doubled);
    expect(battles).toHaveLength(2);
  });

  it("returns an empty array for a page with no battle objects", () => {
    expect(parseWaveWarzBattlesPage("<html><body>no battles here</body></html>")).toEqual([]);
  });

  it("skips malformed battle objects and continues parsing remaining records", () => {
    // A fixture with one valid battle, one malformed battle (invalid JSON syntax),
    // and another valid battle. The parser should skip the malformed record
    // and only return the two valid ones without throwing.
    const mixedFixtureHTML = String.raw`
<script>self.__next_f.push([1,"3:[\"$\",\"$L20\",\"1784001227\",{\"data\":{\"battle_id\":1784001227,\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"Saturday in LA\",\"song2Title\":\"CUTTING OLD TIES\",\"song1Handle\":\"BennyJ504WaveWarz\",\"song2Handle\":\"frameworkfortune\",\"totalVolSol\":\"0.5152\",\"winnerTitle\":\"Saturday in LA\",\"loserTitle\":\"CUTTING OLD TIES\",\"marginPct\":\"98\"}}],[\"$\",\"$L20\",\"1783999999\",{\"data\":{\"battle_id\":1783999999,\"dateFormatted\":\"truncated,\"marginPct\":}}],[\"$\",\"$L20\",\"1783999631\",{\"data\":{\"battle_id\":1783999631,\"dateFormatted\":\"Jul 14, 2026\",\"song1Title\":\"INTRO\",\"song2Title\":\"Say Nothin\",\"song1Handle\":null,\"song2Handle\":\"RoCkY2GriMeY\",\"totalVolSol\":\"0.1477\",\"winnerTitle\":\"INTRO\",\"loserTitle\":\"Say Nothin\",\"marginPct\":null}}]"]);</script>
`;
    const battles = parseWaveWarzBattlesPage(mixedFixtureHTML);
    // Should return only the two valid battles (1784001227 and 1783999631),
    // skipping the malformed one (1783999999).
    expect(battles).toHaveLength(2);
    expect(battles.map((b) => b.battleId).sort()).toEqual([1783999631, 1784001227]);
  });
});
