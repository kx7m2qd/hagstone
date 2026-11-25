import java.util.List;
import java.util.regex.Pattern;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
public class Search {
  private final List<String> names = List.of("alice", "bob");

  @GetMapping("/search")
  public List<String> search(@RequestParam String q) {
    // ruleid: java-regex-injection
    Pattern p = Pattern.compile(q, Pattern.CASE_INSENSITIVE);
    return names.stream().filter(n -> p.matcher(n).find()).toList();
  }

  void servlet(HttpServletRequest request) {
    String filter = request.getParameter("filter");
    for (String n : names) {
      // ruleid: java-regex-injection
      if (n.matches(".*" + filter + ".*")) System.out.println(n);
    }
  }

  @PostMapping("/redact")
  public String redact(@RequestParam String word, @RequestBody String text) {
    // ruleid: java-regex-injection
    return text.replaceAll(word, "***");
  }

  // --- safe ------------------------------------------------------------------------------------

  @GetMapping("/search-quoted")
  public List<String> searchQuoted(@RequestParam String q) {
    // ok: java-regex-injection
    Pattern p = Pattern.compile(Pattern.quote(q), Pattern.CASE_INSENSITIVE);
    return names.stream().filter(n -> p.matcher(n).find()).toList();
  }

  @GetMapping("/validate")
  public boolean validate(@RequestParam String email) {
    // ok: java-regex-injection
    return email.matches("[^@]+@[^@]+\\.[a-z]+");
  }

  @PostMapping("/normalize")
  public String normalize(@RequestBody String text) {
    // ok: java-regex-injection
    return text.replaceAll("\\s+", " ");
  }
}
