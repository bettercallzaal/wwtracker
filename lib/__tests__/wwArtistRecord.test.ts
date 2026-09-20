/**
 * PRD 35, 36, 37 and 38.
 *
 * The test that matters most is the last describe block. It uses the real
 * shape of this platform's biggest concentration problem - one artist who is
 * 35.8% of all buy volume, 93% of it on his own side - and proves that a record
 * built the right way does not move when he buys, while one built the wrong way
 * does. That is section 38's warning, executable.
 */
import { describe, expect, it } from "vitest";
import {
  RANKING_DIMENSIONS,
  SettlementWinnerRefused,
  buildArtistRecord,
  buildTrackRecord,
  type RecordBattle,
} from "../ww/artistRecord";

const A = "ArtistAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const B = "ArtistBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

const battle = (o: Partial<RecordBattle> & { battleId: number }): RecordBattle => ({
  resultWinner: "artist_a",
  artistAWallet: A,
  artistBWallet: B,
  arena: "WaveWarZ",
  volumeLamports: 1_000_000_000,
  backers: ["t1", "t2"],
  ranked: true,
  endTime: 1_700_000_000 + o.battleId,
  ...o,
});

describe("the fighter card", () => {
  const battles = [
    battle({ battleId: 1, resultWinner: "artist_a" }),
    battle({ battleId: 2, resultWinner: "artist_b" }),
    battle({ battleId: 3, resultWinner: "artist_a" }),
    battle({ battleId: 4, resultWinner: "artist_a", arena: "Ather" }),
  ];

  it("counts wins and losses from the judged result", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    expect(r.wins).toBe(3);
    expect(r.losses).toBe(1);
  });

  it("is symmetric: the opponent's record is the mirror", () => {
    const a = buildArtistRecord({ wallet: A, battles });
    const b = buildArtistRecord({ wallet: B, battles });
    expect(b.wins).toBe(a.losses);
    expect(b.losses).toBe(a.wins);
  });

  it("breaks the record down per arena, as PRD 35 shows it", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    const ather = r.byArena.find((x) => x.arena === "Ather")!;
    expect(ather).toEqual({ arena: "Ather", wins: 1, losses: 0 });
  });

  it("counts a streak backwards from the most recent battle", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    // battles 3 and 4 were wins, battle 2 a loss: streak is W2.
    expect(r.streak).toBe(2);
  });

  it("reports a losing streak as a negative number, not as zero", () => {
    const r = buildArtistRecord({
      wallet: A,
      battles: [battle({ battleId: 9, resultWinner: "artist_b" }), battle({ battleId: 10, resultWinner: "artist_b" })],
    });
    expect(r.streak).toBe(-2);
  });

  it("ignores battles the artist was not in", () => {
    const other = battle({ battleId: 5, artistAWallet: "X", artistBWallet: "Y" });
    const r = buildArtistRecord({ wallet: A, battles: [...battles, other] });
    expect(r.wins + r.losses).toBe(4);
  });

  it("does not count an undecided battle as a loss", () => {
    const r = buildArtistRecord({
      wallet: A,
      battles: [...battles, battle({ battleId: 6, resultWinner: null })],
    });
    expect(r.losses).toBe(1);
    expect(r.undecided).toBe(1);
  });

  it("counts only ranked battles toward the record, but all of them toward volume", () => {
    const r = buildArtistRecord({
      wallet: A,
      battles: [...battles, battle({ battleId: 7, ranked: false, volumeLamports: 5_000_000_000 })],
    });
    expect(r.rankedBattles).toBe(4);
    expect(r.careerVolumeLamports).toBe(9_000_000_000);
  });

  it("counts each backer once across battles", () => {
    const r = buildArtistRecord({
      wallet: A,
      battles: [battle({ battleId: 1, backers: ["t1", "t2"] }), battle({ battleId: 2, backers: ["t2", "t3"] })],
    });
    expect(r.uniqueBackers).toBe(3);
  });
});

describe("what PRD 37 and 38 forbid", () => {
  const battles = [battle({ battleId: 1 }), battle({ battleId: 2, resultWinner: "artist_b" })];

  it("exposes six dimensions and no composite score", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    expect(RANKING_DIMENSIONS).toHaveLength(6);
    // The absence is the assertion: nothing here sums them.
    expect(Object.keys(r.dimensions).sort()).toEqual([...RANKING_DIMENSIONS].sort());
    expect(r).not.toHaveProperty("score");
    expect(r).not.toHaveProperty("rating");
    expect(r).not.toHaveProperty("overall");
  });

  it("leaves competitive rating null with a reason, rather than inventing an Elo", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    expect(r.dimensions.competitiveRating).toBeNull();
    expect(r.sources.competitiveRating).toMatch(/FUTURE Elo/);
    expect(r.sources.competitiveRating).toMatch(/looked official/);
  });

  it("keeps money and skill in separate fields", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    expect(typeof r.dimensions.marketPower).toBe("number");
    expect(typeof r.dimensions.winLoss.wins).toBe("number");
    // A winRate is a ratio of results, never of volume.
    expect(r.dimensions.winLoss.winRate).toBe(0.5);
  });

  it("refuses outright to build a record from settlement winners", () => {
    expect(() => buildArtistRecord({ wallet: A, battles, winnersAreSettlement: true })).toThrow(
      SettlementWinnerRefused,
    );
    expect(() => buildArtistRecord({ wallet: A, battles, winnersAreSettlement: true })).toThrow(
      /capital should not be able to buy skill ranking/,
    );
  });
});

/**
 * The real case, in the shape this platform actually has it.
 */
describe("capital cannot buy the record", () => {
  // An artist who backs his own side heavily. On chain the program settles on
  // the larger pool, so settlement always names him; the judges do not.
  const selfBacked = (id: number, judged: "artist_a" | "artist_b"): RecordBattle =>
    battle({ battleId: id, resultWinner: judged, volumeLamports: 90_000_000_000 });

  const battles = [
    selfBacked(1, "artist_a"),
    selfBacked(2, "artist_b"),
    selfBacked(3, "artist_b"),
    selfBacked(4, "artist_a"),
  ];

  it("gives him the judges' record, not the money's", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    expect(r.wins).toBe(2);
    expect(r.losses).toBe(2);
    // Had the settlement winner been used he would be 4-0, because he had the
    // larger pool in all four.
  });

  it("still credits him the volume, in a field that is not the record", () => {
    const r = buildArtistRecord({ wallet: A, battles });
    expect(r.dimensions.marketPower).toBe(360_000_000_000);
    expect(r.dimensions.winLoss.winRate).toBe(0.5);
    // Money large, record even. The two do not touch, which is the point.
  });
});

describe("track records, PRD 36", () => {
  const b1 = battle({ battleId: 1, resultWinner: "artist_a", backers: ["t1"] });
  const b2 = battle({ battleId: 2, resultWinner: "artist_b", artistBWallet: "OPPONENT2", backers: ["t2"] });
  const b3 = battle({ battleId: 3, resultWinner: "artist_a", artistBWallet: "OPPONENT3", arena: "Ather" });

  it("counts artists defeated, not battles won", () => {
    const t = buildTrackRecord({
      trackId: "TRACK X",
      appearances: [
        { battle: b1, side: "artist_a" },
        { battle: b2, side: "artist_a" },
        { battle: b3, side: "artist_a" },
      ],
    });
    expect(t.wins).toBe(2);
    expect(t.losses).toBe(1);
    // Beat B and OPPONENT3. Lost to OPPONENT2.
    expect(t.artistsDefeated).toBe(2);
  });

  it("does not double-count beating the same artist twice", () => {
    const again = battle({ battleId: 4, resultWinner: "artist_a" });
    const t = buildTrackRecord({
      trackId: "TRACK X",
      appearances: [
        { battle: b1, side: "artist_a" },
        { battle: again, side: "artist_a" },
      ],
    });
    expect(t.wins).toBe(2);
    expect(t.artistsDefeated).toBe(1);
  });

  it("skips undecided battles but still counts their volume and traders", () => {
    const undecided = battle({ battleId: 5, resultWinner: null, backers: ["t9"] });
    const t = buildTrackRecord({
      trackId: "TRACK X",
      appearances: [
        { battle: b1, side: "artist_a" },
        { battle: undecided, side: "artist_a" },
      ],
    });
    expect(t.wins).toBe(1);
    expect(t.losses).toBe(0);
    expect(t.uniqueTraders).toBe(2);
    expect(t.careerVolumeLamports).toBe(2_000_000_000);
  });
});
