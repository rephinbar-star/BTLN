import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoupleTypeCard } from "@/components/CoupleTypeCard";

export const SampleSection = () => {
  return (
    <section className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-sm text-muted-foreground uppercase tracking-wider">Examples</p>
          <h2 className="mt-3 text-[28px] font-medium tracking-tight sm:text-[36px]">
            What your report looks like.
          </h2>
        </div>

        <Tabs defaultValue="romantic" className="mt-12 w-full">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-[400px] grid-cols-3">
              <TabsTrigger value="romantic">Romantic</TabsTrigger>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="family">Family</TabsTrigger>
            </TabsList>
          </div>

          <div className="mt-8 flex justify-center">
            <TabsContent value="romantic" className="w-full">
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <CoupleTypeCard coupleTypeId={1} relationshipType="romantic" size="full" className="shadow-[var(--shadow-card)]" />
                <CoupleTypeCard coupleTypeId={6} relationshipType="romantic" size="full" className="shadow-[var(--shadow-card)]" />
                <CoupleTypeCard coupleTypeId={13} relationshipType="romantic" size="full" className="shadow-[var(--shadow-card)]" />
              </div>
            </TabsContent>

            <TabsContent value="friends" className="w-full">
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <CoupleTypeCard coupleTypeId={2} relationshipType="friend" size="full" className="shadow-[var(--shadow-card)]" />
                <CoupleTypeCard coupleTypeId={7} relationshipType="friend" size="full" className="shadow-[var(--shadow-card)]" />
                <CoupleTypeCard coupleTypeId={5} relationshipType="friend" size="full" className="shadow-[var(--shadow-card)]" />
              </div>
            </TabsContent>

            <TabsContent value="family" className="w-full">
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                <CoupleTypeCard coupleTypeId={2} relationshipType="family" size="full" className="shadow-[var(--shadow-card)]" />
                <CoupleTypeCard coupleTypeId={4} relationshipType="family" size="full" className="shadow-[var(--shadow-card)]" />
                <CoupleTypeCard coupleTypeId={8} relationshipType="family" size="full" className="shadow-[var(--shadow-card)]" />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </section>
  );
};
