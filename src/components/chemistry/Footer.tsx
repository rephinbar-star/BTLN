import logoAsset from "@/assets/logo.png.asset.json";

export const Footer = () => {
  return (
    <footer className="border-t border-border px-5 pt-0 pb-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center -space-y-10 sm:flex-row sm:-space-x-10 sm:space-y-0">
        <img src={logoAsset.url} alt="BetweenTheLines™" className="h-24 w-auto -mt-[3px]" />
        <nav className="mt-[20px] flex items-center gap-6 text-[14px] text-muted-foreground">
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Feedback</a>
          <a href="/admin" className="hover:text-foreground">Admin</a>
        </nav>
      </div>
      {/* Spacer so sticky mobile CTA never overlaps footer */}
      <div className="h-16 sm:hidden" />
    </footer>
  );
};