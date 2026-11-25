import java.io.*;
import java.nio.file.*;
import javax.servlet.http.HttpServletRequest;
import org.apache.commons.io.FilenameUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

public class Files1 {
  static final String BASE = "/srv/files/";

  void read(HttpServletRequest req) throws IOException {
    String name = req.getParameter("file");
    // ruleid: java-path-traversal
    FileInputStream in = new FileInputStream(BASE + name);
    in.close();
  }

  void parentChild(HttpServletRequest req) {
    // ruleid: java-path-traversal
    File f = new File(BASE, req.getHeader("X-File"));
    f.delete();
  }

  void nio(HttpServletRequest req) throws IOException {
    // ruleid: java-path-traversal
    Path p = Paths.get(BASE, req.getParameter("p"));
    java.nio.file.Files.readAllBytes(p);
  }

  @PostMapping("/upload")
  public void upload(MultipartFile file) throws IOException {
    // ruleid: java-path-traversal
    file.transferTo(new File(BASE + file.getOriginalFilename()));
  }

  @GetMapping("/doc/{name}")
  public byte[] doc(@PathVariable String name) throws IOException {
    Path base = Paths.get(BASE);
    // ruleid: java-path-traversal
    return java.nio.file.Files.readAllBytes(base.resolve(name));
  }

  void basenameOnly(HttpServletRequest req) throws IOException {
    String name = FilenameUtils.getName(req.getParameter("file"));
    // ok: java-path-traversal
    new FileInputStream(BASE + name).close();
  }

  @GetMapping("/invoice/{name}")
  public byte[] basenameIdiom(@PathVariable String name) throws IOException {
    Path base = Paths.get(BASE);
    // ok: java-path-traversal
    return java.nio.file.Files.readAllBytes(base.resolve(Paths.get(name).getFileName().toString()));
  }

  void fixed() throws IOException {
    // ok: java-path-traversal
    new FileReader(BASE + "index.txt").close();
  }

  void extensionOnly(HttpServletRequest request) throws IOException {
    String ext = FilenameUtils.getExtension(request.getParameter("name"));
    // ok: java-path-traversal
    new FileOutputStream(BASE + java.util.UUID.randomUUID() + "." + ext).close();
  }
}
