import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockAnonMessages = [{ id: "1", role: "user", content: "Hello" }];
const mockAnonFileSystemData = { "/App.jsx": { content: "export default () => <div />" } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false });
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });
});

describe("useAuth — signIn", () => {
  test("returns the action result", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({ id: "new-1" } as any);

    const { result } = renderHook(() => useAuth());
    let returned: any;

    await act(async () => {
      returned = await result.current.signIn("user@example.com", "wrong");
    });

    expect(returned).toEqual({ success: false, error: "Invalid credentials" });
  });

  test("sets isLoading to true while in flight, false when done", async () => {
    let resolveSignIn!: (v: any) => void;
    vi.mocked(signInAction).mockReturnValue(
      new Promise((res) => { resolveSignIn = res; })
    );

    const { result } = renderHook(() => useAuth());

    act(() => { result.current.signIn("a@b.com", "pass"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveSignIn({ success: false }); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when action throws", async () => {
    vi.mocked(signInAction).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signIn("a@b.com", "pass")).rejects.toThrow("Network error");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not redirect on failed sign-in", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: false, error: "Invalid credentials" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "wrong"); });

    expect(mockPush).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
  });
});

describe("useAuth — signUp", () => {
  test("returns the action result", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    let returned: any;

    await act(async () => {
      returned = await result.current.signUp("taken@example.com", "pass");
    });

    expect(returned).toEqual({ success: false, error: "Email already registered" });
  });

  test("sets isLoading to true while in flight, false when done", async () => {
    let resolveSignUp!: (v: any) => void;
    vi.mocked(signUpAction).mockReturnValue(
      new Promise((res) => { resolveSignUp = res; })
    );

    const { result } = renderHook(() => useAuth());

    act(() => { result.current.signUp("new@example.com", "pass"); });
    expect(result.current.isLoading).toBe(true);

    await act(async () => { resolveSignUp({ success: false }); });
    expect(result.current.isLoading).toBe(false);
  });

  test("resets isLoading to false even when action throws", async () => {
    vi.mocked(signUpAction).mockRejectedValue(new Error("Server error"));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.signUp("a@b.com", "pass")).rejects.toThrow("Server error");
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("does not redirect on failed sign-up", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: false, error: "Email already registered" });

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("taken@example.com", "pass"); });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useAuth — handlePostSignIn: anonymous work", () => {
  test("creates project from anon work and redirects when anon messages exist", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({
      messages: mockAnonMessages,
      fileSystemData: mockAnonFileSystemData,
    });
    vi.mocked(createProject).mockResolvedValue({ id: "anon-project-1" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(createProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^Design from /),
      messages: mockAnonMessages,
      data: mockAnonFileSystemData,
    });
    expect(clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-project-1");
    expect(getProjects).not.toHaveBeenCalled();
  });

  test("does not use anon work when messages array is empty", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({ messages: [], fileSystemData: {} });
    vi.mocked(getProjects).mockResolvedValue([{ id: "existing-1", name: "My Design" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(createProject).not.toHaveBeenCalled();
    expect(clearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-1");
  });

  test("does not use anon work when getAnonWorkData returns null", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([{ id: "existing-1", name: "My Design" }] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(createProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-1");
  });
});

describe("useAuth — handlePostSignIn: existing projects", () => {
  test("redirects to the most recent project when user has projects", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([
      { id: "proj-1", name: "Latest" },
      { id: "proj-2", name: "Older" },
    ] as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(mockPush).toHaveBeenCalledWith("/proj-1");
    expect(createProject).not.toHaveBeenCalled();
  });

  test("creates a new project and redirects when user has no projects", async () => {
    vi.mocked(signInAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue(null);
    vi.mocked(getProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockResolvedValue({ id: "brand-new" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signIn("a@b.com", "pass"); });

    expect(createProject).toHaveBeenCalledWith({
      name: expect.stringMatching(/^New Design #\d+$/),
      messages: [],
      data: {},
    });
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });
});

describe("useAuth — signUp post-sign-in flow", () => {
  test("runs the same post-sign-in logic after successful sign-up", async () => {
    vi.mocked(signUpAction).mockResolvedValue({ success: true });
    vi.mocked(getAnonWorkData).mockReturnValue({
      messages: mockAnonMessages,
      fileSystemData: mockAnonFileSystemData,
    });
    vi.mocked(createProject).mockResolvedValue({ id: "signup-project" } as any);

    const { result } = renderHook(() => useAuth());
    await act(async () => { await result.current.signUp("new@example.com", "pass"); });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: mockAnonMessages })
    );
    expect(clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/signup-project");
  });
});
