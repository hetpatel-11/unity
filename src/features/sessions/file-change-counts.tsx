export function FileChangeCounts({
	additions,
	deletions,
}: {
	additions: number;
	deletions: number;
}) {
	if (additions === 0 && deletions === 0) return null;
	return (
		<span className="file-change-stats">
			{additions > 0 ? (
				<span className="file-change-additions">+{additions}</span>
			) : null}
			{deletions > 0 ? (
				<span className="file-change-deletions">-{deletions}</span>
			) : null}
		</span>
	);
}
