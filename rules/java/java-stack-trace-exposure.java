import java.io.PrintWriter;
import java.util.Arrays;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class Errors {
  void servlet(HttpServletRequest req, HttpServletResponse resp) throws Exception {
    try {
      run();
    } catch (Exception e) {
      // ruleid: java-stack-trace-exposure
      e.printStackTrace(resp.getWriter());
    }
  }

  void servlet2(HttpServletRequest req, HttpServletResponse resp) throws Exception {
    PrintWriter out = resp.getWriter();
    try {
      run();
    } catch (Exception e) {
      // ruleid: java-stack-trace-exposure
      e.printStackTrace(out);
    }
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<String> handle(Exception e) {
    // ruleid: java-stack-trace-exposure
    return ResponseEntity.status(500).body(ExceptionUtils.getStackTrace(e));
  }

  @ExceptionHandler(IllegalStateException.class)
  public String handle2(IllegalStateException e) {
    // ruleid: java-stack-trace-exposure
    return "Error: " + Arrays.toString(e.getStackTrace());
  }

  // --- safe ------------------------------------------------------------------------------------

  @ExceptionHandler(RuntimeException.class)
  public ResponseEntity<String> handleSafe(RuntimeException e) {
    org.slf4j.LoggerFactory.getLogger(Errors.class).error("request failed", e);
    // ok: java-stack-trace-exposure
    return ResponseEntity.status(500).body("Internal error");
  }

  void logged(HttpServletResponse resp) {
    try {
      run();
    } catch (Exception e) {
      // ok: java-stack-trace-exposure
      e.printStackTrace();
    }
  }

  void run() throws Exception {}
}
