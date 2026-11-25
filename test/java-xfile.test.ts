import { describe, expect, it } from "vitest";
import { calledElsewhere, collectCalls, declarations, injectedSink, isRequestRule, ownParamSource, newCallIndex, newTypeInfo, parseTypes, relatedTypes, relocate, ruleSections, type SinkSummary } from "../src/engines/java-xfile.js";

describe("parseTypes", () => {
  it("reads package, classes and supertypes, ignoring generics and comments", () => {
    const t = parseTypes(`package com.example.shop;
// class Fake extends Nope {
/* interface Hidden {} */
public class OrderService extends BaseService<Order> implements Auditable, java.io.Serializable {
  static class Inner implements Runnable {}
}`);
    expect(t.pkg.get("OrderService")).toBe("com.example.shop");
    expect([...t.supers.get("OrderService")!].sort()).toEqual(["Auditable", "BaseService", "Serializable"]);
    expect([...t.supers.get("Inner")!]).toEqual(["Runnable"]);
    expect(t.supers.has("Fake")).toBe(false);
    expect(t.supers.has("Hidden")).toBe(false);
  });
});

describe("relatedTypes", () => {
  const types = parseTypes(`
interface Repo {}
class JdbcRepo implements Repo {}
class CachedRepo extends JdbcRepo {}
class A extends HttpServlet {}
class B extends HttpServlet {}
class C extends HttpServlet {}`);

  it("includes supertypes and subtypes transitively", () => {
    expect(relatedTypes("JdbcRepo", types)).toEqual(["CachedRepo", "JdbcRepo", "Repo"]);
    expect(relatedTypes("Repo", types)).toEqual(["CachedRepo", "JdbcRepo", "Repo"]);
  });

  it("never includes siblings through a shared supertype, nor library supertypes", () => {
    expect(relatedTypes("A", types)).toEqual(["A"]);
  });

  it("stays small when thousands of classes share a base (OWASP Benchmark shape)", () => {
    const many = parseTypes(Array.from({ length: 3000 }, (_, i) => `class T${i} extends HttpServlet {}`).join("\n"));
    expect(relatedTypes("T7", many)).toEqual(["T7"]);
  });
});

describe("isRequestRule", () => {
  const rule = (extra = "") => `rules:\n  - id: r\n    metadata:\n      cwe: [x]\n${extra}    mode: taint\n    pattern-sources:\n      - pattern: (HttpServletRequest $REQ).getParameter(...)\n`;
  it("joins taint rules with request sources", () => expect(isRequestRule(rule())).toBe(true));
  it("lets a narrow-source rule opt out", () => expect(isRequestRule(rule("      xfile: false\n"))).toBe(false));
});

describe("ruleSections", () => {
  it("splits a rule at its 4-space keys", () => {
    const s = ruleSections(`rules:
  - id: java-x
    mode: taint
    pattern-sources:
      - pattern: a
    pattern-sinks:
      - pattern: b
`);
    expect(s.get("mode")).toBe("taint\n");
    expect(s.get("pattern-sources")).toBe("      - pattern: a\n");
    expect(s.get("pattern-sinks")).toBe("      - pattern: b\n\n");
  });
});

describe("relocate", () => {
  const inner = { path: "Repo.java", start: { line: 19, col: 5 }, end: { line: 19, col: 40 }, lines: "stmt.executeQuery(sql);" };
  const sinks: SinkSummary[] = [{ id: 0, rule: "java-sql-injection", cls: "Repo", method: "find", index: 0, inner }];

  it("moves a finding at an injected sink to the inner sink and keeps the call in the flow", () => {
    const r = {
      check_id: "java-sql-injection",
      path: "Controller.java",
      start: { line: 10, col: 9 },
      end: { line: 10, col: 30 },
      extra: { lines: "repo.find(name);", metavars: { $XF0: { abstract_content: "repo" } } },
    };
    expect(injectedSink(r)).toBe(0);
    const [out] = relocate([r], sinks) as (typeof r & { extra: { dataflow_trace?: any } })[];
    expect(out!.path).toBe("Repo.java");
    expect(out!.start.line).toBe(19);
    expect(out!.extra.dataflow_trace.intermediate_vars.at(-1).location.path).toBe("Controller.java");
  });

  it("leaves ordinary findings alone", () => {
    const r = { check_id: "x", path: "A.java", start: { line: 1, col: 1 }, end: { line: 1, col: 2 }, extra: {} };
    relocate([r], sinks);
    expect(r.path).toBe("A.java");
  });
});

describe("calledElsewhere", () => {
  const types = newTypeInfo();
  parseTypes("class OrderRepo implements Repo { List<Order> findByName(String n) { return helper(n); } void audit() { this.log(n); } }", types, "data/OrderRepo.java");
  parseTypes("interface Repo {}", types, "data/Repo.java");
  parseTypes("class A extends HttpServlet { class Test { String doSomething(String s) { return s; } } }", types, "A.java");
  parseTypes("class B extends HttpServlet { class Test { String doSomething(String s) { return s; } } }", types, "B.java");
  const idx = newCallIndex();
  collectCalls("web/OrderController.java", "class OrderController { Repo repo; void get(String name) { repo.findByName(name); list.forEach(this::audit); java.util.List x; } }", idx);
  collectCalls("data/OrderRepo.java", "class OrderRepo implements Repo { List<Order> findByName(String n) { return helper(n); } void audit() { this.log(n); } }", idx);
  collectCalls("web/Unrelated.java", "class Unrelated { void x() { cache.findByName(k); } }", idx);
  collectCalls("A.java", "class A { void doGet() { new Test().doSomething(p); } }", idx);
  collectCalls("B.java", "class B { void doGet() { new Test().doSomething(p); } }", idx);

  it("keeps a method another file calls through a related type", () => {
    expect(calledElsewhere(idx, types, "OrderRepo", "findByName", "./data/OrderRepo.java")).toBe(true);
  });

  it("drops entry points and same-file helpers", () => {
    expect(calledElsewhere(idx, types, "OrderController", "doGet", "web/OrderController.java")).toBe(false);
    expect(calledElsewhere(idx, types, "OrderRepo", "log", "data/OrderRepo.java")).toBe(false);
  });

  it("drops helpers whose only link to the caller is a library supertype (OWASP doSomething shape)", () => {
    parseTypes("class T1 extends HttpServlet { String doSomething(String s) { return s; } }", types, "T1.java");
    collectCalls("T1.java", "class T1 extends HttpServlet { void doGet() { this.doSomething(p); } }", idx);
    collectCalls("T2.java", "class T2 extends HttpServlet { void doGet() { this.doSomething(p); } }", idx);
    expect(calledElsewhere(idx, types, "T1", "doSomething", "T1.java")).toBe(false);
  });

  it("drops class names declared in several files", () => {
    expect(calledElsewhere(idx, types, "Test", "doSomething", "A.java")).toBe(false);
  });

  it("does not treat field access or package names as calls", () => {
    expect(idx.calls.has("util")).toBe(false);
    expect(idx.calls.has("List")).toBe(false);
  });
});

describe("declarations", () => {
  const md5 = `class MD5 {
  public static String getHashString(File f) throws IOException { return x(new FileInputStream(f)); }
  public static String getHashString(@NonNull final String s) { return y(s); }
  // public static String getHashString(Object commented) {}
  public static String getHashString(String s, String enc) { return getHashString(s); }
  String other() { return MD5.getHashString(name); }
  abstract Map<String, List<Integer>> getHashString(java.util.Map<String, Integer> m, byte [] b);
}`;

  it("lists each overload's parameter types and ignores calls and comments", () => {
    expect(declarations(md5, "getHashString")).toEqual([["File"], ["String"], ["String", "String"], ["java.util.Map", "byte[]"]]);
  });

  it("finds a single declaration", () => {
    expect(declarations(md5, "other")).toEqual([[]]);
  });
});

describe("ownParamSource", () => {
  const text = `class C {
  public String search(@RequestParam("q") String q, HttpServletRequest req) {
    return q + req.getParameter("x");
  }
}`;
  const m = text.indexOf("search");
  const at = (offset: number) => ({
    check_id: "xf-return",
    path: "C.java",
    start: { line: 3, col: 5 },
    end: { line: 3, col: 40 },
    extra: {
      metavars: { $M: { abstract_content: "search", start: { line: 2, col: 17, offset: m } } },
      dataflow_trace: { taint_source: ["CliLoc", [{ path: "C.java", start: { line: 2, col: 1, offset } }, ""]] },
    },
  });

  it("is true for a source in the parameter list", () => {
    expect(ownParamSource(text, at(text.indexOf("String q")))).toBe(true);
  });

  it("is false for a source in the body", () => {
    expect(ownParamSource(text, at(text.indexOf("req.getParameter")))).toBe(false);
  });

  it("is false without offsets", () => {
    expect(ownParamSource(text, { check_id: "x", path: "C.java", start: { line: 1, col: 1 }, end: { line: 1, col: 1 }, extra: {} })).toBe(false);
  });
});

describe("relocate from test code", () => {
  it("keeps a finding whose call site is in a test at the call site", () => {
    const inner = { path: "src/main/java/a/Svc.java", start: { line: 9, col: 1 }, end: { line: 9, col: 9 }, lines: "new File(d)" };
    const r = {
      check_id: "java-path-traversal",
      path: "src/test/java/a/SvcTest.java",
      start: { line: 4, col: 1 },
      end: { line: 4, col: 9 },
      extra: { metavars: { $XF0: { abstract_content: "svc" } } },
    };
    relocate([r], [{ id: 0, rule: "java-path-traversal", cls: "Svc", method: "run", index: 0, inner }]);
    expect(r.path).toBe("src/test/java/a/SvcTest.java");
  });
});
