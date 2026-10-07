export function liveCollapsibleIsOpen(
	live: boolean,
	openedByUser: boolean,
): boolean {
	return live || openedByUser;
}

export function openedByUserFromToggle(
	live: boolean,
	nextOpen: boolean,
	openedByUser: boolean,
): boolean {
	if (live) return openedByUser;
	return nextOpen;
}

export function openedByUserAfterLiveChange(
	live: boolean,
	wasLive: boolean,
	openedByUser: boolean,
): boolean {
	if (wasLive && !live) return false;
	return openedByUser;
}
