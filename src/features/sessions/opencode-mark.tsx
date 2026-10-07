export function OpenCodeMark({ size = 24 }: { size?: number }) {
	return (
		<svg
			aria-hidden="true"
			fill="none"
			height={size}
			viewBox="128 96 256 320"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<path d="M320 224V352H192V224H320Z" fill="currentColor" opacity="0.35" />
			<path
				clipRule="evenodd"
				d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
				fill="currentColor"
				fillRule="evenodd"
			/>
		</svg>
	);
}
