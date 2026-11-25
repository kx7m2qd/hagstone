# Java SAST (roadmap step 3, first language)

Status: 11 rules built 2026-11-20; 24 since 2026-11-25 (launch-goal batches: SSRF, unsafe
deserialization, Jackson polymorphic typing, SpEL/script injection, regex injection, CSRF disabled,
upload filename, stack traces, client-controlled authorization, world-writable files, IDOR, open
admin/actuator paths, admin paths without a role). Gate: `npm run bench:owasp:java` (per category, CI) and the
`bench/cases/spring-app` case in `npm run bench`.

## Rules (`rules/java/`)

| Rule | CWE | Sources → sinks |
|---|---|---|
| `java-sql-injection` | 89 | request → `Statement.execute*`, `prepareStatement(concat)`, JdbcTemplate, JPA/Hibernate `createQuery`/`createNativeQuery` |
| `java-command-injection` | 78 | request → `Runtime.exec`, `ProcessBuilder` (command, arguments, environment) |
| `java-path-traversal` | 22 | request, `MultipartFile.getOriginalFilename()` → `File`, file streams, `Paths.get`, `Path.resolve` |
| `java-ldap-injection` | 90 | request → `DirContext.search` base / filter (not `{0}` arguments) |
| `java-xpath-injection` | 643 | request → `XPath.compile` / `evaluate` |
| `java-xss` | 79 | request → `response.getWriter()` / `getOutputStream()` writes |
| `java-trust-boundary` | 501 | request → `HttpSession.setAttribute` / `putValue` |
| `java-weak-hash` | 328 | `MessageDigest` MD2/MD4/MD5/SHA-1, commons-codec and Guava equivalents |
| `java-weak-cipher` | 327 | DES/3DES/RC2/RC4/Blowfish, ECB, bare `"AES"` (not RSA/ECB) |
| `java-weak-random` | 330 | `java.util.Random` / `Math.random` / `RandomStringUtils` → cookie, session, header, `set*Token` |
| `java-insecure-cookie` | 614 | `setSecure(false)`, cookie added without `setSecure(true)`, `ResponseCookie.secure(false)` |
| `java-ssrf` | 918 | request → RestTemplate, WebClient, `HttpClient`, `URL.openStream`, Apache/OkHttp, Jsoup |
| `java-unsafe-deserialization` | 502 | request → `ObjectInputStream.readObject` (no `ObjectInputFilter`), `XMLDecoder` |
| `java-jackson-polymorphic-typing` | 502 | `enableDefaultTyping`, `activateDefaultTyping` with a permissive validator, `@JsonTypeInfo(use = CLASS)` |
| `java-code-injection` | 94/917 | request → SpEL (not `SimpleEvaluationContext`), `ScriptEngine.eval`, Groovy, MVEL, OGNL, JEXL |
| `java-regex-injection` | 1333 | request → `Pattern.compile`, `String.matches` / `replaceAll` / `split` |
| `java-csrf-disabled` | 352 | `csrf().disable()` / `csrf(AbstractHttpConfigurer::disable)` unless the chain is `STATELESS` |
| `java-upload-client-filename` | 434 | `getOriginalFilename()` / `getSubmittedFileName()` → `File`, `Paths.get`, `resolve` (not in log calls) |
| `java-stack-trace-exposure` | 209 | `printStackTrace(response.getWriter())`, stack-trace strings returned from handlers |
| `java-client-controlled-authorization` | 863 | role-named param / header / cookie → `"admin".equals(x)`, `if (isAdmin)` (opts out of cross-file) |
| `java-world-writable-permissions` | 732 | `"rwxrwxrwx"`-style permissions, `OTHERS_WRITE`, `setWritable(true, false)` |
| `java-idor-unscoped-lookup` | 639 | `findById(@PathVariable id)` in a handler that takes the principal but never uses it |
| `java-admin-route-without-auth` | 306 | `permitAll()` / `web.ignoring()` on admin, management or actuator paths; `anyRequest().permitAll()` |
| `java-admin-route-without-role-check` | 862 | admin / management / actuator paths that are only `.authenticated()` |

Shared: sources are servlet request getters (javax + jakarta) and Spring MVC / JAX-RS parameter
annotations, matched at the parameter's declaration so dataflow (and guards) apply; numeric, boolean,
UUID and date parameters are not sources. Sanitizers: numeric parsing, and an allowlist or regex
guard that rejects the value (`if (!allowed.contains(x)) throw …`, `if (!x.matches(re)) return`).

## Decisions (measured on the OWASP Benchmark for Java v1.2, 2,740 tests)

- **`--taint-intrafile` for Java only.** Average score 0.53 → 0.72 for Java (`--no-intrafile` reproduces the lower one) (helpers in the same file
  return constants in most "safe" tests). For Python it adds false positives and drops 5 categories
  below their gate, so the scan runs two Opengrep passes in parallel (`rulePasses`).
- **No container propagators.** A `List.add` propagator changed nothing with intrafile on.
- **Accepted false positives:** the benchmark's `list.remove(0)` index shifting and `switch` on a
  constant char. Modelling them would be tuning to the benchmark.
- **Accepted misses:** hash/crypto algorithms read from a properties file at run time (~30% of those
  categories). Special-casing benchmark helpers is not allowed.
- **Cross-file taint (2026-11-25, `src/engines/java-xfile.ts`).** Opengrep has none, so we build method
  summaries with Opengrep itself: "parameter k of `Class.method` reaches a sink" and "`Class.method`
  returns request data", then inject calls to those methods as sinks/sources into copies of the Java
  rules, repeating until nothing new is found (max 5 rounds). Findings at an injected sink move to the
  inner sink, with the call site kept in the data flow. Calls are matched by receiver type (the class,
  project supertypes, subtypes; never siblings or library supertypes such as `HttpServlet`), and a
  summary is kept only if another file calls the method and names that type; simple class names
  declared in several files are skipped. Without that filter the benchmark produced ~1,150 summaries
  (every `doGet` and per-file `doSomething`), 1.1 GB of rules and a crash; with it, 4 summaries.
  Result: every injection category has 0 misses; average 0.72 → 0.77 (cmdi 0.67 → 0.74, sqli 0.68 →
  0.73, pathtraver 0.56 → 0.64, trustbound 0.40 → 0.54, xss 0.75 → 0.85, ldapi 0.67 → 0.75). xpathi
  0.78 → 0.75: two more `switch`/`list.remove(0)` false positives now reachable from
  `SeparateClassRequest` (accepted, above). Benchmark scan ~3 min. `--no-xfile` on `bench:owasp`
  turns it off.
- **Cross-file precision guards (from real projects).** (1) Overloads: when the declaring file has
  several methods with that name, the injected sink requires the argument's declared type
  (`MD5.getHashString(String)` must not match the `File` overload's sink). (2) A method whose request
  data comes only from its own parameters (a controller's `@RequestParam`) is not a source for its
  callers; their arguments decide. (3) A call from test or example code is never relocated into
  production code.
- **JdbcTemplate by name** when its type isn't visible (a static field of another class): receivers
  named `*jdbc*` with JdbcTemplate method names.

## Real projects (2026-11-20; cross-file re-run 2026-11-25)

- 2026-11-25, cross-file on: petclinic still 0; WebGoat 21 → 22, the new one a real command injection
  (`@RequestParam("base")` in `CommandInjectionTask2` → `/bin/sh -c` in `CommandExecutionService`).
  Before the guards above it was 25 (an overload mix-up in `MD5`, two test-file calls into
  controllers). WebGoat Java scan 5 s → ~35 s (summary rounds).

- spring-petclinic: 0 Java findings.
- WebGoat: 21, all in vulnerable lessons; spot-checked three (WebWolf upload path, weak random secret,
  audit-log SQL through a helper): all real. Not yet covered: XXE, open redirect, JWT, Spring
  Security misconfiguration (SSRF, deserialization, SpEL/script injection added 2026-11-25).
- 2026-11-25, batch-1 rules: WebGoat +2 (deserialization and SSRF lessons, both real), petclinic 0,
  macrozheng/mall 1 (`activateDefaultTyping(LaissezFaireSubTypeValidator)` for Redis values: real
  risk if Redis is writable). No false positives. Python: PyGoat SSRF lab found; NetBox 1
  (`DATA_UPLOAD_MAX_NUMBER_FIELDS = None`, deliberate for bulk delete: accurate, team's call).
- 2026-11-25, batches 2-3 (24 rules, all languages): WebGoat 8 (CSRF disabled ×2, `/actuator/**`
  public, stack trace in lesson feedback, two uploads stored under the client filename), PyGoat 5
  (cookie `admin == "1"`, open `/internal`, `@csrf_exempt` ×3), petclinic / mall / NetBox /
  juice-shop / realworld 0. All accurate after fixing three false positives the check found:
  `security.sanitizeFilename(...)` not seen as a sanitizer (juice-shop), a `File` built inside
  `log.debug` (WebGoat), and a token-auth GraphQL view's `@csrf_exempt` (NetBox).
- The cross-file pass took its return-summary sources from the first request rule by name; a narrow
  new rule sorting first silently dropped two bench flows. It now takes the rule with the most
  sources, and narrow rules opt out with `xfile: false`.

## Next

1. Rules for the uncovered classes above, then MyBatis `${}` in XML mappers and eGovFrame.
2. Real-CVE-fix cases for Java (like `bench:cves`).
