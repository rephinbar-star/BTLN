import solidBondAsset from "@/assets/t01_solid_bond_romantic.png.asset.json";

export const SampleCard = () => {
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <img
        src={solidBondAsset.url}
        alt="Sample BetweenTheLines result card — Solid Bond, a romantic couple type"
        width={1024}
        height={1280}
        loading="lazy"
        className="w-full h-auto rounded-[20px] shadow-[var(--shadow-card)]"
      />
    </div>
  );
};