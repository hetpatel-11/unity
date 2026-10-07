declare module "@novnc/novnc" {
	export default class RFB {
		constructor(
			target: HTMLElement,
			url: string,
			options?: { readonly credentials?: { readonly password?: string } },
		);
		scaleViewport: boolean;
		clipViewport: boolean;
		resizeSession: boolean;
		showDotCursor: boolean;
		background: string;
		disconnect(): void;
	}
}
