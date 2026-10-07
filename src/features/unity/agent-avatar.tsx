export function AgentAvatar({
  title,
  unity = false,
}: {
  title: string;
  unity?: boolean;
}) {
  const slot =
    (Math.max(0, (Number(title.match(/Agent (\d+)/)?.[1]) || 1) - 1) % 10) +
    (/Agent \d+B/.test(title) ? 10 : 0);
  return (
    <span
      className={
        unity
          ? "agent-avatar agent-avatar-unity"
          : "agent-avatar agent-avatar-portrait"
      }
      style={
        unity
          ? undefined
          : {
              backgroundImage: "url(/brand/agent-portraits.png)",
              backgroundPosition: `${(slot % 5) * 25}% ${(Math.floor(slot / 5) * 100) / 3}%`,
            }
      }
      aria-hidden="true"
    >
      {unity ? <img src="/brand/unity.svg" alt="" /> : null}
    </span>
  );
}
