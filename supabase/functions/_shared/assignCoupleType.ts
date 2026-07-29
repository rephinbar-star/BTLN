export function assignCoupleType(
  analysisJson: any,
  relationshipType: string,
  analysisId = "compare",
): number | null {
  try {
    const score = analysisJson?.headline?.score;
    const horsemen = analysisJson?.four_horsemen ?? {};
    const horsemenList = ["contempt", "criticism", "defensiveness", "stonewalling"] as const;
    const horsemenCount = horsemenList.filter((h) => horsemen?.[h]?.present === true).length;
    const bids = analysisJson?.bids_for_connection ?? {};
    const subScores = analysisJson?.sub_scores ?? {};
    const profiles = analysisJson?.attachment_profiles ?? {};
    const styles: string[] = Object.values(profiles).map(
      (p: any) => p?.primary_style,
    );
    const safetyConcern = analysisJson?.meta?.safety_concern === true;

    const ctx = {
      analysisId,
      relationshipType,
      score,
      horsemenCount,
      horsemenPresent: horsemenList.filter((h) => horsemen?.[h]?.present === true),
      turned_toward_pct: bids?.turned_toward_pct,
      total_bids_observed: bids?.total_bids_observed,
      spark: subScores?.spark,
      styles,
      safetyConcern,
    };
    console.log("[couple_type] inputs", JSON.stringify(ctx));

    const decide = (): { id: number | null; rule: string } => {
      if (safetyConcern) return { id: null, rule: "rule1_safety_override" };
      if (typeof score !== "number") return { id: null, rule: "no_score" };

      if (
        horsemenCount >= 2 &&
        (bids?.turned_toward_pct ?? 0) >= 35 &&
        (subScores?.spark ?? 0) >= 70 &&
        score >= 50 &&
        score <= 69
      ) {
        return { id: 13, rule: "rule2_fire_pair" };
      }
      if (horsemenCount >= 3 && score < 50) return { id: 10, rule: "rule3_brave_duo" };
      if (horsemen?.contempt?.present === true && score < 35)
        return { id: 11, rule: "rule4_solo_climbers" };
      if (score < 50 && (bids?.total_bids_observed ?? 0) < 5)
        return { id: 12, rule: "rule5_quiet_companions" };

      if (score >= 40 && score <= 59) {
        const hasMixed = styles.length === 2 && styles[0] !== styles[1];
        if (hasMixed) return { id: 9, rule: "rule6_duet_mixed" };
      }

      const bothSecure = styles.length > 0 && styles.every((s) => s === "secure");
      const bothAnxious = styles.length > 0 && styles.every((s) => s === "anxious");
      const bothAvoidant = styles.length > 0 && styles.every((s) => s === "avoidant");
      const isAnxAvo = styles.includes("anxious") && styles.includes("avoidant");
      const isSecAnx = styles.includes("secure") && styles.includes("anxious");
      const isSecAvo = styles.includes("secure") && styles.includes("avoidant");

      if (bothSecure && score >= 80) return { id: 1, rule: "rule7_power_couple" };
      if (bothSecure && score >= 65 && score <= 79)
        return { id: 2, rule: "rule7_steady_anchors" };
      if (bothSecure && score >= 60 && score <= 64)
        return { id: 3, rule: "rule7_slow_burners" };
      if (bothAnxious) return { id: 4, rule: "rule7_deep_feelers" };
      if (bothAvoidant) return { id: 5, rule: "rule7_independent_duo" };
      if (isAnxAvo) return { id: 6, rule: "rule7_magnet_moon" };
      if (isSecAnx && score >= 65) return { id: 7, rule: "rule7_support_system" };
      if (isSecAvo && score >= 60 && score <= 79)
        return { id: 8, rule: "rule7_builders" };

      if (score >= 80) return { id: 1, rule: "rule8_fallback_power" };
      if (score >= 65) return { id: 2, rule: "rule8_fallback_steady" };
      if (score >= 50) return { id: 9, rule: "rule8_fallback_duet" };
      if (score >= 35) return { id: 10, rule: "rule8_fallback_brave" };
      return { id: 11, rule: "rule8_fallback_solo" };
    };

    const { id, rule } = decide();
    console.log("[couple_type] decision", JSON.stringify({ analysisId, rule, id }));
    return id;
  } catch (e) {
    console.error(
      "[couple_type] error",
      analysisId,
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
