import type { IngestMessage, IngestParticipant } from "@/lib/ingest/parse";
import { computeWrappedStats } from "@/lib/wrapped/stats";

export type ExampleMessage = { id: string; sender: string; text: string; ts: string };
const m = (id: string, sender: string, text: string, ts: string): ExampleMessage => ({ id, sender, text, ts });

export const quickMessages = [
  m("q1","You","Still want to grab dinner this week?","2026-08-11T17:42:00Z"),
  m("q2","Alex","Yes — sorry, work is chaos. Thursday should work, but I might run late.","2026-08-11T17:49:00Z"),
];
export const pairMessages = [
  m("d1","Maya","Are we still on for Friday? No stress if work is wild.","2026-02-06T09:02:00Z"),
  m("d2","Jonas","Work is bad, but yes, I still want to see you.","2026-02-06T09:18:00Z"),
  m("d3","Maya","Okay, I wasn't sure if the silence meant plans had changed.","2026-02-06T09:21:00Z"),
  m("d4","Jonas","I said work was bad, I wasn't ignoring you.","2026-02-06T09:24:00Z"),
  m("d5","Jonas","Sorry—I should have answered the actual question.","2026-02-06T09:26:00Z"),
  m("d6","Maya","Thank you. Can you confirm by six tomorrow?","2026-02-06T09:31:00Z"),
  m("d7","Jonas","Yes. I'll message by six, and if Friday falls apart let's do Sunday.","2026-02-06T09:34:00Z"),
  m("d8","Maya","Perfect. How did the presentation go?","2026-02-06T09:38:00Z"),
  m("d9","Jonas","Better than expected. Your pep talk helped.","2026-02-06T09:44:00Z"),
  m("d10","Maya","I'm glad. Want me to bring dinner Friday?","2026-02-06T09:47:00Z"),
  m("d11","Jonas","Please. I can pick the place once I know my finish time.","2026-02-06T09:55:00Z"),
  m("d12","Maya","Deal ❤️","2026-02-06T09:57:00Z"),
];
export const groupMessages = [
  m("g1","Priya","Dinner at Maya's this weekend?","2026-05-08T10:00:00Z"), m("g2","Maya","Yes! Friday or Saturday?","2026-05-08T10:03:00Z"),
  m("g3","Dev","Saturday is easier for me.","2026-05-08T10:05:00Z"), m("g4","Sam","Saturday works 👍","2026-05-08T10:18:00Z"),
  m("g5","Priya","Should we do food or just snacks?","2026-05-08T10:21:00Z"), m("g6","Dev","I'll sort snacks.","2026-05-08T10:23:00Z"),
  m("g7","Maya","I'll make pasta. Any allergies?","2026-05-08T10:27:00Z"), m("g8","Priya","None here — I'll bring dessert 😂","2026-05-08T10:31:00Z"),
  m("g9","Dev","No allergies for me.","2026-05-08T10:34:00Z"), m("g10","Maya","So Saturday at 7, mine?","2026-05-08T10:40:00Z"),
  m("g11","Priya","Confirmed ❤️","2026-05-08T10:41:00Z"), m("g12","Dev","Confirmed. Snacks are handled.","2026-05-08T10:43:00Z"),
  m("g13","Sam","Can't, work thing — sorry, I read the date wrong.","2026-05-09T08:02:00Z"), m("g14","Maya","No problem. Sunday at 7 instead?","2026-05-09T08:08:00Z"),
  m("g15","Priya","Sunday works for me.","2026-05-09T08:10:00Z"), m("g16","Dev","Same. I'll move the snack operation.","2026-05-09T08:12:00Z"),
];
export const wrappedMessages = [
  m("w1","Person A","First coffee of the year? ☕","2025-01-02T10:10:00Z"), m("w2","Person B","Saturday? 😂","2025-01-02T10:22:00Z"),
  m("w3","Person A","Perfect ❤️","2025-01-02T10:24:00Z"), m("w4","Person B","Beach tomorrow?","2025-04-12T18:00:00Z"),
  m("w5","Person A","Yes, early before it gets busy.","2025-04-12T18:18:00Z"), m("w6","Person B","I'll bring snacks 😂","2025-04-12T18:20:00Z"),
  m("w7","Person A","Birthday picnic starts now ❤️","2025-08-16T20:00:00Z"), m("w8","Person B","Best plan all year 😂","2025-08-16T20:06:00Z"),
  m("w9","Person A","Photo attached","2025-08-16T20:08:00Z"), m("w10","Person B","That sunset 🥲","2025-08-16T20:11:00Z"),
  m("w11","Person A","Same time next year?","2025-12-30T21:00:00Z"), m("w12","Person B","Already in my calendar ❤️","2025-12-30T21:05:00Z"),
];
export const journeyConversations = [
 {id:"feb",label:"February 2026 · Maya & Jonas",messages:pairMessages.slice(0,7)},
 {id:"may",label:"May 2026 · Close friends group",messages:groupMessages.slice(0,10)},
 {id:"aug",label:"August 2026 · Maya & Jonas",messages:[m("j1","Maya","Still okay for tonight?","2026-08-14T15:20:00Z"),m("j2","Jonas","I still want to see you—I can confirm by six.","2026-08-14T15:24:00Z"),m("j3","Maya","That update helps, thank you.","2026-08-14T15:26:00Z"),m("j4","Jonas","Confirmed for 7. I'll book the table.","2026-08-14T17:42:00Z"),m("j5","Maya","Perfect. See you then ❤️","2026-08-14T17:44:00Z"),m("j6","Jonas","On my way.","2026-08-14T18:38:00Z")]},
];
const people: IngestParticipant[] = [
 {id:"a",display_name:"Person A",aliases:[],message_count:6,excluded:false,is_self:true,looks_like_system:false},
 {id:"b",display_name:"Person B",aliases:[],message_count:6,excluded:false,is_self:false,looks_like_system:false},
];
const ingest: IngestMessage[] = wrappedMessages.map((x,order)=>({participant_id:x.sender==="Person A"?"a":"b",raw_sender:x.sender,content:x.text,ts:x.ts,kind:x.id==="w9"?"attachment":"message",order}));
export const calculatedWrappedExample = computeWrappedStats(ingest,people,{kind:"year",from:"2025-01-01",to:"2025-12-31",label:"2025"});
