import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExampleMessage } from "@/lib/examples/sourceFixtures";

const formatStamp = (value: string) => new Intl.DateTimeFormat("en", { month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit", timeZone:"UTC" }).format(new Date(value));
const Row = ({ message }: { message: ExampleMessage }) => <li className="min-w-0 border-t border-btln-line py-3 first:border-t-0"><div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><strong className="break-words text-sm">{message.sender}</strong><time dateTime={message.ts} className="text-xs text-muted-foreground">{formatStamp(message.ts)}</time></div><p className="mt-1 min-w-0 whitespace-pre-wrap break-words text-[15px] leading-6">{message.text}</p></li>;
export function SourceConversation({messages,title="The conversation"}:{messages:ExampleMessage[];title?:string}){
 const [expanded,setExpanded]=useState(false); const id=useId(); const first=messages.slice(0,5); const rest=messages.slice(5); const shown=expanded?messages.length:first.length;
 return <section className="min-w-0 border-t border-btln-line py-7" aria-labelledby={`${id}-title`}><h2 id={`${id}-title`} className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">Showing {shown} of {messages.length} messages</p><ol className="mt-3 min-w-0">{first.map(x=><Row key={x.id} message={x}/>)}</ol>{rest.length>0&&<><Button type="button" variant="link" onClick={()=>setExpanded(x=>!x)} aria-expanded={expanded} aria-controls={id} className="min-h-11 px-0 text-foreground underline underline-offset-4">{expanded?"Less":"More"}</Button><ol id={id} hidden={!expanded} className="min-w-0">{rest.map(x=><Row key={x.id} message={x}/>)}</ol></>}</section>;
}
