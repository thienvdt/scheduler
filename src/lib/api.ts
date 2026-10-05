import type {
  ApiError,
  Conflict,
  Room,
  RoomInput,
  Session,
  SessionInput,
  Teacher,
  TeacherInput,
  Template,
  TemplateInput,
  AuthState,
  User,
  UserInput,
  ProfileId,
  Settings,
} from "@/shared/types";

/** Phát ra khi API trả 401 (hết phiên đăng nhập) để giao diện quay về màn hình đăng nhập. */
export interface SampleCounts {
  people: number;
  rooms: number;
  sessions: number;
}

export const AUTH_REQUIRED_EVENT = "lich-giang:auth-required";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public conflicts: Conflict[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as T | ApiError | null;
  if (!res.ok) {
    const err = data as ApiError | null;
    if (res.status === 401 && !path.startsWith("/auth/")) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    throw new ApiRequestError(res.status, err?.error ?? `Lỗi ${res.status}`, err?.conflicts);
  }
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  auth: {
    me: () => request<AuthState>("/auth/me"),
    setup: (input: { username: string; display_name: string; password: string; profile: ProfileId; org_name: string }) =>
      request<AuthState>("/auth/setup", send("POST", input)),
    login: (username: string, password: string) => request<AuthState>("/auth/login", send("POST", { username, password })),
    logout: () => request<void>("/auth/logout", send("POST")),
    changePassword: (current_password: string, new_password: string) =>
      request<void>("/auth/password", send("POST", { current_password, new_password })),
  },
  settings: {
    get: () => request<Settings>("/settings"),
    update: (input: Partial<Settings> & { add_templates?: boolean }) => request<Settings>("/settings", send("PUT", input)),
    sampleCounts: () => request<SampleCounts>("/settings/sample"),
    sample: (action: "load" | "clear") => request<SampleCounts>("/settings/sample", send("POST", { action })),
  },
  users: {
    list: () => request<User[]>("/users"),
    create: (input: UserInput) => request<User>("/users", send("POST", input)),
    update: (id: string, input: Partial<UserInput>) => request<User>(`/users/${id}`, send("PUT", input)),
    remove: (id: string) => request<void>(`/users/${id}`, send("DELETE")),
  },
  teachers: {
    list: () => request<Teacher[]>("/teachers"),
    create: (input: TeacherInput) => request<Teacher>("/teachers", send("POST", input)),
    update: (id: string, input: TeacherInput) => request<Teacher>(`/teachers/${id}`, send("PUT", input)),
    remove: (id: string) => request<void>(`/teachers/${id}`, send("DELETE")),
  },
  rooms: {
    list: () => request<Room[]>("/rooms"),
    create: (input: RoomInput) => request<Room>("/rooms", send("POST", input)),
    update: (id: string, input: RoomInput) => request<Room>(`/rooms/${id}`, send("PUT", input)),
    remove: (id: string) => request<void>(`/rooms/${id}`, send("DELETE")),
  },
  templates: {
    list: () => request<Template[]>("/templates"),
    create: (input: TemplateInput) => request<Template>("/templates", send("POST", input)),
    update: (id: string, input: Partial<TemplateInput>) => request<Template>(`/templates/${id}`, send("PUT", input)),
    remove: (id: string) => request<void>(`/templates/${id}`, send("DELETE")),
  },
  sessions: {
    list: (params: { from: string; to: string; teacherId?: string; roomId?: string; kind?: string }) => {
      const q = new URLSearchParams({ from: params.from, to: params.to });
      if (params.teacherId) q.set("teacherId", params.teacherId);
      if (params.roomId) q.set("roomId", params.roomId);
      if (params.kind) q.set("kind", params.kind);
      return request<Session[]>(`/sessions?${q}`);
    },
    create: (input: SessionInput) => request<Session[]>("/sessions", send("POST", input)),
    update: (id: string, input: Partial<SessionInput>) => request<Session>(`/sessions/${id}`, send("PUT", input)),
    remove: (id: string, scope?: "following") =>
      request<void>(`/sessions/${id}${scope ? `?scope=${scope}` : ""}`, send("DELETE")),
  },
};
