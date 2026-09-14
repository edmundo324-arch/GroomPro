"use client";
import {useState} from "react";
export function HeyRosieSettings(){const[s,setS]=useState(false);return <div className="gp-settings-card gp-settings-wide"><h2>Hey Rosie / Zapier</h2><p>Zapier Webhooks can send Rosie calls and conversations into GroomPro.</p><button className="gp-btn" onClick={()=>setS(!s)}>{s?"Hide":"Setup"}</button>{s&&<p>POST to <code>/api/integrations/zapier/rosie</code> and send <code>x-groompro-webhook-secret</code>. Add <code>HEYROSIE_ZAPIER_SECRET</code> in GoDaddy Secrets.</p>}</div>}
