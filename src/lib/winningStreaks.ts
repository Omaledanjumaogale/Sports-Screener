/** A streak requires wins > losses on consecutive calendar dates. Missing/tied days break it. */
export function winningStreaks(snapshots: Array<{dayKey:string; rows:Array<{group:string;picks:number;wins:number;losses:number}>}>) {
  const result=new Map<string,{cur:number;max:number;days:number}>();let previousDay:number|undefined;
  for(const snapshot of [...snapshots].sort((a,b)=>a.dayKey.localeCompare(b.dayKey))){
    const day=Date.parse(`${snapshot.dayKey}T00:00:00Z`);if(!Number.isFinite(day))continue;
    if(previousDay!==undefined&&day-previousDay!==86400000)for(const value of result.values())value.cur=0;
    const present=new Set<string>();
    for(const row of snapshot.rows){if(!row||row.picks<=0)continue;present.add(row.group);const value=result.get(row.group)??{cur:0,max:0,days:0};value.days++;value.cur=row.wins>row.losses?value.cur+1:0;value.max=Math.max(value.max,value.cur);result.set(row.group,value);}
    for(const[group,value]of result)if(!present.has(group))value.cur=0;
    previousDay=day;
  }return result;
}
