// The extracted UI calls browser adapters directly; no server runtime is included.
export function useServerFn<T>(action: T): T {
	return action;
}
