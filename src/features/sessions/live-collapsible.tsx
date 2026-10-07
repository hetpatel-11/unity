import {
	type DetailsHTMLAttributes,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	liveCollapsibleIsOpen,
	openedByUserAfterLiveChange,
	openedByUserFromToggle,
} from "#/domain/live-collapsible";

export function LiveCollapsible({
	live,
	children,
	...props
}: {
	live: boolean;
	children: ReactNode;
} & Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "open" | "onToggle">) {
	const [openedByUser, setOpenedByUser] = useState(false);
	const wasLive = useRef(live);

	useEffect(() => {
		setOpenedByUser((current) =>
			openedByUserAfterLiveChange(live, wasLive.current, current),
		);
		wasLive.current = live;
	}, [live]);

	return (
		<details
			{...props}
			open={liveCollapsibleIsOpen(live, openedByUser)}
			onToggle={(event) => {
				const nextOpen = event.currentTarget.open;
				setOpenedByUser((current) =>
					openedByUserFromToggle(live, nextOpen, current),
				);
			}}
		>
			{children}
		</details>
	);
}
