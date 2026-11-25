package com.example.shop;

import java.io.ByteArrayInputStream;
import java.io.ObjectInputStream;
import java.util.Base64;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.SimpleEvaluationContext;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/integrations")
public class IntegrationController {
  private static final Set<String> PARTNERS = Set.of("hooks.partner.example");
  private static final List<String> CATALOG = List.of("Blue Mug", "Red Mug", "Green Teapot");

  private final RestTemplate rest = new RestTemplate();
  private final ExpressionParser spel = new SpelExpressionParser();
  private final WebhookClient webhooks;

  public IntegrationController(WebhookClient webhooks) {
    this.webhooks = webhooks;
  }

  @GetMapping("/preview")
  public String preview(@RequestParam String url) {
    // expect: java-ssrf
    return rest.getForObject(url, String.class);
  }

  @GetMapping("/preview-safe")
  public String previewSafe(@RequestParam String host) {
    if (!PARTNERS.contains(host)) throw new IllegalArgumentException("unknown partner");
    return rest.getForObject("https://" + host + "/v1/status", String.class);
  }

  @GetMapping("/github")
  public String github(@RequestParam String user) {
    return rest.getForObject("https://api.github.com/users/" + user, String.class);
  }

  @PostMapping("/webhooks/test")
  public int testWebhook(@RequestParam String callback) {
    // Cross-file: the request is made in WebhookClient.
    return webhooks.ping(callback);
  }

  @GetMapping("/price")
  public Object price(@RequestParam String formula) {
    // expect: java-code-injection
    return spel.parseExpression(formula).getValue();
  }

  @PostMapping("/price-safe")
  public Object priceSafe(@RequestParam String field, @RequestBody Product product) {
    EvaluationContext ctx = SimpleEvaluationContext.forReadOnlyDataBinding().build();
    return spel.parseExpression(field).getValue(ctx, product);
  }

  @PostMapping("/cart/restore")
  public Object restoreCart(@CookieValue("cart") String cart) throws Exception {
    byte[] raw = Base64.getDecoder().decode(cart);
    ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(raw));
    // expect: java-unsafe-deserialization
    return in.readObject();
  }

  @GetMapping("/catalog")
  public List<String> catalog(@RequestParam String q) {
    // expect: java-regex-injection
    Pattern p = Pattern.compile(q, Pattern.CASE_INSENSITIVE);
    return CATALOG.stream().filter(n -> p.matcher(n).find()).toList();
  }

  @GetMapping("/catalog-safe")
  public List<String> catalogSafe(@RequestParam String q) {
    Pattern p = Pattern.compile(Pattern.quote(q), Pattern.CASE_INSENSITIVE);
    return CATALOG.stream().filter(n -> p.matcher(n).find()).toList();
  }

  public static class Product {
    public String name;
    public long priceCents;
  }
}
