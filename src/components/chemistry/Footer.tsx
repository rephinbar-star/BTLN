import { BottomNav } from "@/components/nav/BottomNav";

export const Footer = () => {
  return (
    <footer className="h-[calc(70px+env(safe-area-inset-bottom))] md:h-auto">
      <BottomNav />
    </footer>
  );
};
