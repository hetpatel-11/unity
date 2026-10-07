import {defineTool} from 'eve/tools';
import {z} from 'zod';
import {unityRequest} from '../lib/transport';
export default defineTool({
 description:'Delegate a coding task to an existing agent using a concrete implementation brief. Read its transcript first. Use control_thread instead for literal message relays or pause/resume.',
 inputSchema:z.object({threadId:z.string(),goal:z.string().min(1),context:z.string().min(1),constraints:z.array(z.string()).min(1),verification:z.array(z.string()).min(1)}),
 execute:({threadId,goal,context,constraints,verification},ctx)=>unityRequest(`/internal/threads/${encodeURIComponent(threadId)}/control`,{action:'message',text:`Goal\n${goal}\n\nContext\n${context}\n\nConstraints\n${constraints.map(s=>'- '+s).join('\n')}\n\nVerification\n${verification.map(s=>'- '+s).join('\n')}\n\nReport actual changes and checks back to Unity. Preserve your existing isolated workspace. Ask a concrete question if a required decision is missing.`},ctx.session.id),
});
