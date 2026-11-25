import java.io.InputStream;
import java.net.URI;
import java.net.URL;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Set;
import javax.servlet.http.HttpServletRequest;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import org.apache.http.client.methods.HttpGet;
import org.jsoup.Jsoup;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;

@RestController
public class Fetcher {
  private final RestTemplate rest = new RestTemplate();
  private final WebClient web = WebClient.create();
  private final HttpClient http = HttpClient.newHttpClient();
  private static final Set<String> ALLOWED = Set.of("api.partner.example");

  @GetMapping("/fetch")
  public String fetch(@RequestParam String url) {
    // ruleid: java-ssrf
    return rest.getForObject(url, String.class);
  }

  @GetMapping("/preview")
  public String preview(@RequestParam("u") String target) {
    // ruleid: java-ssrf
    return web.get().uri(target).retrieve().bodyToMono(String.class).block();
  }

  @PostMapping("/hook")
  public int hook(@RequestBody String callback) throws Exception {
    // ruleid: java-ssrf
    HttpRequest req = HttpRequest.newBuilder(URI.create(callback)).build();
    return http.send(req, HttpResponse.BodyHandlers.discarding()).statusCode();
  }

  void servlet(HttpServletRequest request) throws Exception {
    String src = request.getParameter("src");
    URL u = new URL(src);
    // ruleid: java-ssrf
    try (InputStream in = u.openStream()) {
      in.readAllBytes();
    }
  }

  void apache(HttpServletRequest request) {
    // ruleid: java-ssrf
    HttpGet get = new HttpGet("http://" + request.getParameter("host") + "/status");
  }

  void okhttp(HttpServletRequest request) throws Exception {
    // ruleid: java-ssrf
    Request r = new Request.Builder().url(request.getHeader("X-Callback")).build();
    new OkHttpClient().newCall(r).execute();
  }

  void jsoup(HttpServletRequest request) throws Exception {
    // ruleid: java-ssrf
    Jsoup.connect(request.getParameter("page")).get();
  }

  // --- safe ------------------------------------------------------------------------------------

  @GetMapping("/user")
  public String user(@RequestParam String name) {
    // ok: java-ssrf
    return rest.getForObject("https://api.github.com/users/" + name, String.class);
  }

  @GetMapping("/item")
  public String item(@RequestParam String sku) {
    // ok: java-ssrf
    return rest.getForObject(String.format("https://shop.example/items/%s", sku), String.class);
  }

  @GetMapping("/order")
  public String order(@RequestParam long id) {
    // ok: java-ssrf
    return rest.getForObject("http://orders/" + id, String.class);
  }

  @GetMapping("/allowlisted")
  public String allowlisted(@RequestParam String host) {
    if (!ALLOWED.contains(host)) throw new IllegalArgumentException(host);
    // ok: java-ssrf
    return rest.getForObject("https://" + host + "/v1/status", String.class);
  }

  @PostMapping("/events")
  public String events(@RequestBody String payload) {
    // ok: java-ssrf
    return rest.postForObject("https://api.example.com/v1/events", payload, String.class);
  }

  void constant() throws Exception {
    // ok: java-ssrf
    new URL("https://status.example.com/health").openStream().close();
  }
}
