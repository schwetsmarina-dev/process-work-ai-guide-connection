import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
function handler(path,client){
 let serve;
 const code=readFileSync(path,"utf8").replace(/^import .*;\n/,"").replace(/: Record<string, unknown>/g,"");
 new Function("createClientFromRequest","Deno",code)(()=>client,{serve:f=>{serve=f;}});
 if (typeof serve !== "function") throw new Error("Function did not register a Deno.serve handler");
 return serve;
}
const now=new Date().toISOString();
const old=new Date(Date.now()-48*3600*1000).toISOString();
function client(session,stamp=old){
 const Session={filter:vi.fn(async()=>[session]),update:vi.fn(async()=>{})};
 const Message={filter:vi.fn(async()=>[{created_at:stamp,content:"test"}])};
 const UserJourneyEvent={create:vi.fn(async()=>{})};
 return {auth:{me:vi.fn(async()=>({id:"owner",email:"owner@example.test"}))},asServiceRole:{entities:{Session,Message,UserJourneyEvent}}};
}
describe("inactive-session behavior",()=>{
 it("keeps an idle session resumable and does not invent abandonment",async()=>{
 const c=client({id:"s",user_id:"owner",started_at:old,status:"active"});
 const response=await handler("base44/functions/abandonStaleSessions/entry.ts",c)(new Request("https://test"));
 expect((await response.json()).paused).toBe(1);
 expect(c.asServiceRole.entities.Session.update).not.toHaveBeenCalled();
 expect(c.asServiceRole.entities.UserJourneyEvent.create).not.toHaveBeenCalled();
 });
 it("uses last activity rather than session start",async()=>{
 const c=client({id:"s",user_id:"owner",started_at:old,status:"active"},now);
 const response=await handler("base44/functions/abandonStaleSessions/entry.ts",c)(new Request("https://test"));
 expect((await response.json()).paused).toBe(0);
 });
 it("offers follow-up for an idle active session",async()=>{
 const c=client({id:"s",user_id:"owner",started_at:old,status:"active",user_message_count:1});
 const response=await handler("base44/functions/abandonmentFollowUp/entry.ts",c)(new Request("https://test",{method:"POST",body:JSON.stringify({action:"pending"})}));
 expect((await response.json()).session.id).toBe("s");
 expect(c.asServiceRole.entities.Session.update).toHaveBeenCalledWith("s",expect.not.objectContaining({status:"abandoned"}));
 });
 it("does not interrupt a recently resumed session",async()=>{
 const c=client({id:"s",user_id:"owner",started_at:old,status:"active",user_message_count:1},now);
 const response=await handler("base44/functions/abandonmentFollowUp/entry.ts",c)(new Request("https://test",{method:"POST",body:JSON.stringify({action:"pending"})}));
 expect((await response.json()).session).toBeNull();
 });
});
