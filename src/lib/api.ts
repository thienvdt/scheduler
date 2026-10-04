import type {
  ApiError,
  Conflict,
  Room,
  RoomInput,
  Session,
  SessionInput,
  Teacher,
  TeacherInput,
} from "@/shared/types";

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
    throw new ApiRequestError(res.status, err?.error ?? `Lỗi ${res.status}`, err?.conflicts);
  }
  return data as T;
}

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
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
  sessions: {
    list: (params: { from: string; to: string; teacherId?: string; roomId?: string }) => {
      const q = new URLSearchParams({ from: params.from, to: params.to });
      if (params.teacherId) q.set("teacherId", params.teacherId);
      if (params.roomId) q.set("roomId", params.roomId);
      return request<Session[]>(`/sessions?${q}`);
    },
    create: (input: SessionInput) => request<Session[]>("/sessions", send("POST", input)),
    update: (id: string, input: Partial<SessionInput>) => request<Session>(`/sessions/${id}`, send("PUT", input)),
    remove: (id: string, scope?: "following") =>
      request<void>(`/sessions/${id}${scope ? `?scope=${scope}` : ""}`, send("DELETE")),
  },
};
