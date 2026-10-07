// Populate the live demo with independent, bounded Codex tasks. Re-running skips existing titles.
const base = process.env.UNITY_API_URL ?? "http://127.0.0.1:4318";
const roles = [
  "Navigation",
  "Authentication",
  "Regression checks",
  "Search",
  "Notifications",
  "Settings",
  "Accessibility",
  "Performance",
  "API",
  "Documentation",
];
const workspace = await (await fetch(base + "/api/workspace")).json();
for (const project of workspace.projects) {
  for (const title of roles) {
    if (project.room.threads.some((t) => t.title === title)) continue;
    const slug = title.toLowerCase().replaceAll(" ", "-");
    const task = `You are the ${title} worker for project ${project.name}. Work ONLY in /tmp/unity-${project.id}-${slug}, create it first. Implement a small working ${title.toLowerCase()} component for a team project management app. Use plain HTML/JS or Node built-ins, no dependencies. Create one meaningful automated check with node --test and run it. Keep this initial task small, finish in one turn. Report exact files and actual check results. Do not touch another worker's directory. If a product decision is needed ask one concrete question.`;
    const response = await fetch(base + "/api/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Unity-Project-Id": project.id,
      },
      body: JSON.stringify({ title, task }),
    });
    if (!response.ok) throw Error(`${project.id}/${title}: ${response.status}`);
    console.log(`Started ${project.name}: ${title}`);
    await new Promise((r) => setTimeout(r, 800));
  }
}
