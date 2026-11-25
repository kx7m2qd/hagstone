import java.security.Principal;
import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class Orders {
  private OrderRepository repo;

  @GetMapping("/orders/{id}")
  public Order get(@PathVariable Long id, Principal principal) {
    // ruleid: java-idor-unscoped-lookup
    return repo.findById(id).orElseThrow();
  }

  @DeleteMapping("/orders/{id}")
  public void delete(@PathVariable("id") Long id, @AuthenticationPrincipal UserDetails user) {
    // ruleid: java-idor-unscoped-lookup
    repo.deleteById(id);
  }

  // --- safe ------------------------------------------------------------------------------------

  @GetMapping("/my/orders/{id}")
  public Order mine(@PathVariable Long id, Principal principal) {
    // ok: java-idor-unscoped-lookup
    Order o = repo.findById(id).orElseThrow();
    if (!o.getOwner().equals(principal.getName())) throw new AccessDeniedException("no");
    return o;
  }

  @GetMapping("/scoped/{id}")
  public Order scoped(@PathVariable Long id, Principal principal) {
    // ok: java-idor-unscoped-lookup
    return repo.findByIdAndOwner(id, principal.getName()).orElseThrow();
  }

  @PostAuthorize("returnObject.owner == authentication.name")
  @GetMapping("/post/{id}")
  public Order post(@PathVariable Long id, Principal principal) {
    // ok: java-idor-unscoped-lookup
    return repo.findById(id).orElseThrow();
  }

  @GetMapping("/products/{id}")
  public Order product(@PathVariable Long id) {
    // ok: java-idor-unscoped-lookup
    return repo.findById(id).orElseThrow();
  }
}
