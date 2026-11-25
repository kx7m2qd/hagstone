import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class AdminApi {
  void servlet(HttpServletRequest request, HttpServletResponse response) throws Exception {
    String role = request.getParameter("role");
    // ruleid: java-client-controlled-authorization
    if ("admin".equals(role)) {
      response.getWriter().print("secret");
    }
  }

  @GetMapping("/admin/users")
  public Object users(@RequestHeader("X-User-Role") String role) {
    // ruleid: java-client-controlled-authorization
    if (!role.equalsIgnoreCase("ADMIN")) throw new SecurityException("forbidden");
    return "users";
  }

  @PostMapping("/admin/purge")
  public String purge(@RequestParam(defaultValue = "false") boolean isAdmin) {
    // ruleid: java-client-controlled-authorization
    if (isAdmin) {
      return "purged";
    }
    return "denied";
  }

  // --- safe ------------------------------------------------------------------------------------

  @GetMapping("/admin/report")
  public String report(Authentication auth) {
    // ok: java-client-controlled-authorization
    if (auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) return "ok";
    return "denied";
  }

  @PostMapping("/users")
  public String create(@RequestParam String name, @RequestParam String role) {
    // ok: java-client-controlled-authorization
    return "created " + name + " as " + role;
  }
}
