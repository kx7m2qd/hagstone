import java.beans.XMLDecoder;
import java.io.ByteArrayInputStream;
import java.io.ObjectInputFilter;
import java.io.ObjectInputStream;
import java.util.Base64;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.*;

@RestController
public class Sessions {
  void servlet(HttpServletRequest request) throws Exception {
    ObjectInputStream in = new ObjectInputStream(request.getInputStream());
    // ruleid: java-unsafe-deserialization
    Object state = in.readObject();
  }

  @PostMapping("/import")
  public Object importCart(@RequestBody byte[] body) throws Exception {
    // ruleid: java-unsafe-deserialization
    return new ObjectInputStream(new ByteArrayInputStream(body)).readObject();
  }

  void cookie(HttpServletRequest request) throws Exception {
    for (Cookie c : request.getCookies()) {
      if (c.getName().equals("prefs")) {
        byte[] raw = Base64.getDecoder().decode(c.getValue());
        ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(raw));
        // ruleid: java-unsafe-deserialization
        ois.readObject();
      }
    }
  }

  @PostMapping("/layout")
  public Object layout(@RequestParam String xml) {
    // ruleid: java-unsafe-deserialization
    XMLDecoder d = new XMLDecoder(new ByteArrayInputStream(xml.getBytes()));
    return d.readObject();
  }

  // --- safe ------------------------------------------------------------------------------------

  void filtered(HttpServletRequest request) throws Exception {
    ObjectInputStream in = new ObjectInputStream(request.getInputStream());
    in.setObjectInputFilter(ObjectInputFilter.Config.createFilter("com.example.Cart;!*"));
    // ok: java-unsafe-deserialization
    Object cart = in.readObject();
  }

  void localFile() throws Exception {
    ObjectInputStream in = new ObjectInputStream(new java.io.FileInputStream("/var/cache/app/index.bin"));
    // ok: java-unsafe-deserialization
    Object index = in.readObject();
  }

  @PostMapping("/json")
  public String json(@RequestBody String body) throws Exception {
    // ok: java-unsafe-deserialization
    return new com.fasterxml.jackson.databind.ObjectMapper().readValue(body, Cart.class).toString();
  }

  static class Cart {}
}
