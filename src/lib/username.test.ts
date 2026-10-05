import { describe, expect, it } from "vitest";
import { suggestUsername } from "./username";

describe("suggestUsername", () => {
  it("uses given name + initials and drops academic titles", () => {
    expect(suggestUsername("ThS. Nguyễn Văn An")).toBe("annv");
    expect(suggestUsername("TS. Trần Thị Bình")).toBe("binhtt");
    expect(suggestUsername("PGS. Lê Minh Cường")).toBe("cuonglm");
    expect(suggestUsername("Đặng Đức")).toBe("ducd");
  });

  it("always returns at least 3 characters", () => {
    expect(suggestUsername("An").length).toBeGreaterThanOrEqual(3);
    expect(suggestUsername("")).toBe("");
  });
});
