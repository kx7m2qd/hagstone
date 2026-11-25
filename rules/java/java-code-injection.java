import groovy.lang.GroovyShell;
import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.servlet.http.HttpServletRequest;
import org.mvel2.MVEL;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.springframework.web.bind.annotation.*;

@RestController
public class Rules {
  private final ExpressionParser parser = new SpelExpressionParser();
  private final ScriptEngine js = new ScriptEngineManager().getEngineByName("js");

  @GetMapping("/calc")
  public Object calc(@RequestParam String expr) {
    // ruleid: java-code-injection
    return parser.parseExpression(expr).getValue();
  }

  @PostMapping("/rule")
  public Object rule(@RequestBody String body) {
    // ruleid: java-code-injection
    Expression e = new SpelExpressionParser().parseExpression("#{" + body + "}");
    return e.getValue();
  }

  void script(HttpServletRequest request) throws Exception {
    String code = request.getParameter("code");
    // ruleid: java-code-injection
    js.eval(code);
  }

  void groovy(HttpServletRequest request) {
    GroovyShell shell = new GroovyShell();
    // ruleid: java-code-injection
    shell.evaluate(request.getParameter("script"));
  }

  @GetMapping("/mvel")
  public Object mvel(@RequestParam String formula) {
    // ruleid: java-code-injection
    return MVEL.eval(formula);
  }

  // --- safe ------------------------------------------------------------------------------------

  @GetMapping("/field")
  public Object field(@RequestParam String path, @RequestBody Object model) {
    EvaluationContext ctx = SimpleEvaluationContext.forReadOnlyDataBinding().build();
    // ok: java-code-injection
    return parser.parseExpression(path).getValue(ctx, model);
  }

  @GetMapping("/field2")
  public Object field2(@RequestParam String path, @RequestBody Object model) {
    // ok: java-code-injection
    return parser.parseExpression(path).getValue(SimpleEvaluationContext.forReadOnlyDataBinding().build(), model);
  }

  @GetMapping("/sum")
  public Object sum(@RequestParam int a, @RequestParam int b) {
    // ok: java-code-injection
    return parser.parseExpression(a + " + " + b).getValue();
  }

  @GetMapping("/discount")
  public Object discount(@RequestParam String tier) {
    if (!java.util.Set.of("gold", "silver").contains(tier)) throw new IllegalArgumentException(tier);
    // ok: java-code-injection
    return parser.parseExpression("@pricing." + tier + "Discount()").getValue();
  }

  void constant() throws Exception {
    // ok: java-code-injection
    js.eval("1 + 1");
  }
}
