export const authClient = {
	useSession: () => ({
		data: {
			user: {
				id: "preview-user",
				name: "Het Patel",
				email: "preview@unity.local",
			},
		},
		isPending: false,
	}),
};
