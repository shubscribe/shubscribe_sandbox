import Module from "module";

export let mockSession: unknown = {
  user: {
    name: "Dev User",
    email: "dev@localhost",
  },
};

export function setMockSession(session: unknown) {
  mockSession = session;
}

const mockModules: Record<string, Record<string, unknown>> = {
  "server-only": {},
  "next/cache": {
    revalidatePath: () => {},
    revalidateTag: () => {},
    unstable_cache: <T>(cb: T) => cb,
  },
  "next/headers": {
    cookies: () => ({
      get: () => undefined,
      set: () => {},
      delete: () => {},
    }),
    headers: () => new Headers(),
  },
  "next/navigation": {
    redirect: (url: string) => {
      const err = new Error("NEXT_REDIRECT") as Error & { digest?: string };
      err.digest = `NEXT_REDIRECT;${url};307;`;
      throw err;
    },
    notFound: () => {
      const err = new Error("NEXT_NOT_FOUND") as Error & { digest?: string };
      err.digest = "NEXT_NOT_FOUND";
      throw err;
    },
    useRouter: () => ({
      push: () => {},
      replace: () => {},
      prefetch: () => {},
      back: () => {},
      forward: () => {},
      refresh: () => {},
    }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
  },
  "next/server": {
    NextResponse: class MockNextResponse extends Response {
      static json(body: unknown, init?: ResponseInit) {
        return new MockNextResponse(JSON.stringify(body), {
          ...init,
          headers: {
            "content-type": "application/json",
            ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
          },
        });
      }
      static redirect(url: string | URL, status = 307) {
        return new MockNextResponse(null, {
          status,
          headers: { Location: url.toString() },
        });
      }
    },
    NextRequest: Request,
  },
  "next-auth": {
    default: () => ({
      handlers: {
        GET: () => new Response("OK"),
        POST: () => new Response("OK"),
      },
      auth: async () => mockSession,
      signIn: async () => {},
      signOut: async () => {},
    }),
  },
  "next-auth/providers/google": {
    default: (config: unknown) => config,
  },
  "next-auth/providers/credentials": {
    default: (config: unknown) => config,
  },
};

type ResolveFilenameFn = (
  request: string,
  parent: { paths: string[] } | null,
  isMain: boolean,
  options?: unknown
) => string;

const originalResolveFilename = (Module as unknown as { _resolveFilename: ResolveFilenameFn })._resolveFilename;

// Inject the mocks into require.cache
for (const [name, exports] of Object.entries(mockModules)) {
  const mockPath = `/mock/${name.replace(/\//g, "_")}`;
  const m = new Module(mockPath);
  m.exports = exports;
  m.loaded = true;
  require.cache[mockPath] = m;
}

// Override _resolveFilename to return the mock path
(Module as unknown as { _resolveFilename: ResolveFilenameFn })._resolveFilename = function (
  request: string,
  parent: { paths: string[] } | null,
  isMain: boolean,
  options?: unknown
) {
  if (mockModules[request]) {
    return `/mock/${request.replace(/\//g, "_")}`;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
