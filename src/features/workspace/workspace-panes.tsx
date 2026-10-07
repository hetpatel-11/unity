import { Children, type ReactNode, useLayoutEffect } from "react";
import { Group, Panel, Separator, useGroupRef } from "react-resizable-panels";
import {
	CHAT_PANE_MIN_WIDTH,
	INSPECTOR_PANE_MIN_WIDTH,
} from "#/domain/inspector-split";

export function WorkspacePanes({
	children,
	open,
	compact,
	ratio,
	view,
	layout,
	onResize,
	onReset,
}: {
	children: ReactNode;
	open: boolean;
	compact: boolean;
	ratio: number;
	view: string;
	layout: string;
	onResize: (ratio: number) => void;
	onReset: () => void;
}) {
	const groupRef = useGroupRef();
	const [chat, inspector] = Children.toArray(children);
	const chatSize = !open ? 100 : compact ? 0 : ratio * 100;
	useLayoutEffect(() => {
		groupRef.current?.setLayout({ chat: chatSize, inspector: 100 - chatSize });
	}, [chatSize, groupRef]);
	return (
		<Group
			groupRef={groupRef}
			className="workspace-body"
			orientation={compact ? "vertical" : "horizontal"}
			disabled={!open || compact}
			defaultLayout={{ chat: chatSize, inspector: 100 - chatSize }}
			data-inspector-collapsed={!open}
			data-inspector-view={view}
			data-layout={layout}
			data-compact={compact}
			onLayoutChanged={(next, meta) => {
				if (meta.isUserInteraction && open && !compact)
					onResize(next.chat / 100);
			}}
		>
			<Panel
				id="chat"
				minSize={open && !compact ? `${CHAT_PANE_MIN_WIDTH}px` : 0}
				maxSize={open && !compact ? "72%" : "100%"}
				collapsible={!open || compact}
				collapsedSize={0}
			>
				{chat}
			</Panel>
			{open && !compact ? (
				<Separator
					className="workspace-separator"
					aria-label="Resize tools panel"
					disableDoubleClick
					onDoubleClick={onReset}
				/>
			) : null}
			<Panel
				id="inspector"
				minSize={open && !compact ? `${INSPECTOR_PANE_MIN_WIDTH}px` : 0}
				collapsible={!open || compact}
				collapsedSize={0}
			>
				{inspector}
			</Panel>
		</Group>
	);
}
