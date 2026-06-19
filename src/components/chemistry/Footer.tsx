import logoAsset from "@/assets/logo.png.asset.json";

export const Footer = () => {
  return (
    <footer className="border-t border-border px-5 pt-0 pb-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 pt-0 pb-8 sm:flex-row sm:justify-center sm:gap-8 sm:px-8">
        <img src={logoAsset.url} alt="BetweenTheLines™" className="h-24 w-auto -mt-[3px]" />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[14px] text-muted-foreground">
          <a href="/trust" className="hover:text-foreground">Trust</a>
          <a href="/privacy" className="hover:text-foreground">Privacy</a>
          <a href="/terms" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Feedback</a>
          <a href="/admin" className="hover:text-foreground">Admin</a>
        </nav>
      </div>
      {/* Spacer so sticky mobile CTA never overlaps footer */}
      <div className="h-16 sm:hidden" />
    </footer>
  );
};