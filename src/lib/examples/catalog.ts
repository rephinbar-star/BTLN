export type ExampleKind = "quick" | "deep" | "group-roast" | "group" | "roast" | "wrapped" | "journey";

export const EXAMPLES: { kind: ExampleKind; name: string; route: string; tryRoute: string }[] = [
  { kind: "quick", name: "Quick Take", route: "/examples/quick", tryRoute: "/quick" },
  { kind: "deep", name: "Deep Read", route: "/examples/deep", tryRoute: "/deep" },
  { kind: "group-roast", name: "Group Roast", route: "/examples/group-roast", tryRoute: "/group-roast" },
  { kind: "group", name: "Group Read", route: "/examples/group", tryRoute: "/group" },
  { kind: "roast", name: "Roast Us", route: "/examples/roast", tryRoute: "/roast" },
  { kind: "wrapped", name: "Wrapped", route: "/examples/wrapped", tryRoute: "/wrapped" },
  // Internal kind stays "journey" so existing links and data keep working.
  { kind: "journey", name: "Relationship360 Preview", route: "/examples/relationship360", tryRoute: "/prime" },

];