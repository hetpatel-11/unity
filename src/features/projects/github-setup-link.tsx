import { needsGithubSetup } from "../../domain/github-sign-in";

export function GithubSetupLink({ message }: { message: string }) {
	if (!needsGithubSetup(message)) return null;
	return <a href="/?addProject=1">Open GitHub setup</a>;
}
