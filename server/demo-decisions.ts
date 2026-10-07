export const decisions = [
 ['Navigation','Should navigation open as a sidebar or a top bar?','Sidebar','Top bar'],
 ['Authentication','Should sign-in offer GitHub or email?','GitHub','Email'],
 ['Regression checks','Should I test the sign-in flow or project creation first?','Sign-in flow','Project creation'],
 ['Search','Should search include completed tasks or only active tasks?','Include completed','Active only'],
 ['Notifications','Should updates appear immediately or in a daily digest?','Immediately','Daily digest'],
 ['Settings','Should preferences apply to this device or the whole team?','This device','Whole team'],
 ['Accessibility','Should I prioritize keyboard shortcuts or high contrast?','Keyboard shortcuts','High contrast'],
 ['Performance','Should I optimize initial load or search response time?','Initial load','Search response'],
 ['API','Should project lists use pagination or load everything?','Pagination','Load everything'],
 ['Documentation','Should the next guide cover onboarding or deployment?','Onboarding','Deployment'],
] as const;
export function decisionFor(index:number) {const d=decisions[index % decisions.length];return `${d[1]} (${d[2]} / ${d[3]})`;}
